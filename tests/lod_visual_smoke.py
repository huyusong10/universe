#!/usr/bin/env python3
"""Exercise the public observatory journey; save images and state for visual review.

This intentionally does not inspect source text or prescribe an artistic recipe.
Missing browser/GPU dependencies exit with code 2, not a false passing result.
"""
from __future__ import annotations

import argparse
import contextlib
import functools
import http.server
import io
import json
import math
import statistics
import sys
import threading
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
STAGES = ("Galactic", "Regional", "LocalMap", "LocalSystem", "Surface")


class EnvironmentUnavailable(RuntimeError):
    pass


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class JourneyServer(http.server.ThreadingHTTPServer):
    # A renderer loads a finite set of maps concurrently. Avoid connection
    # resets from the default five-entry queue during a cold browser start.
    request_queue_size = 128


def guide_section(page, section):
    """Use the actual observing shell; content selection never navigates."""
    key = {'observe': 'guide-observe', 'read': 'map-details', 'related': 'guide-related'}[section]
    control = page.get_by_test_id(key)
    if control.get_attribute('aria-selected') != 'true':
        control.press('Enter')


def toggle_reading(page):
    section = 'observe' if page.get_by_test_id('map-details').get_attribute('aria-selected') == 'true' else 'read'
    guide_section(page, section)


def guide_control(page, key):
    guide_section(page, 'read' if key == 'guide-observe-terrain' else 'observe')
    return page.get_by_test_id(key)


@contextlib.contextmanager
def server_url(existing):
    if existing:
        yield existing
        return
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = JourneyServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def configured_url(url, **options):
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.update({key: str(value) for key, value in options.items()})
    return urlunsplit(parts._replace(query=urlencode(query)))


def state(page):
    result = page.evaluate("window.__universeObservatoryState")
    assert isinstance(result, dict), "debug state is unavailable"
    return result


def wait_ready(page, errors=None):
    page.wait_for_function("""() => ['ready', 'unavailable'].includes(
      document.querySelector('#observatory')?.dataset.state)""", timeout=45000)
    if page.locator("#observatory").get_attribute("data-state") == "unavailable":
        available = page.evaluate("""async () => {
          if (!(navigator.gpu && window.Worker && window.OffscreenCanvas &&
                HTMLCanvasElement.prototype.transferControlToOffscreen)) return false;
          return Boolean(await navigator.gpu.requestAdapter());
        }""")
        message = page.get_by_role("alert").inner_text()
        if not available:
            raise EnvironmentUnavailable(message)
        raise AssertionError(f"renderer failed with available GPU: {message}; {errors or []}")
    page.wait_for_function("""() => window.__universeObservatoryState?.distance > 0""",
                           timeout=15000)


def settled(page):
    # Wait for input to reach the Worker before accepting a previous settled state.
    page.wait_for_timeout(300)
    page.wait_for_function("""() => {
      const s = window.__universeObservatoryState;
      return s && !s.flight && Math.abs(Math.log(s.distance / s.distanceTarget)) < 0.008;
    }""", timeout=20000)
    # State is deliberately low-frequency; let the published state catch up.
    page.wait_for_timeout(220)
    return state(page)


def scrub_scale(page, start=.65, end=.35):
    """Scrub along the control's exposed orientation, independent of layout."""
    slider = page.get_by_test_id("scale-slider")
    orientation = slider.get_attribute("aria-orientation")
    assert orientation in ("horizontal", "vertical")
    rect = slider.bounding_box()
    def point(t):
        return ((rect["x"] + rect["width"] * t, rect["y"] + rect["height"] / 2)
                if orientation == "horizontal" else
                (rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] * t))
    page.mouse.move(*point(start)); page.mouse.down()
    page.mouse.move(*point(end), steps=18); page.mouse.up()
    return point(.5)


def full_observation(page):
    # Reading can change the projection independently of world navigation.
    # Sample coordinates and the fixed zoom lens only after that transition.
    page.wait_for_function("""() => {
      const area = window.__universeObservatoryState?.observationArea;
      return area && area.x === 0 && area.y === 0 && area.width === window.innerWidth && area.height === window.innerHeight;
    }""")
    previous = state(page)
    for _ in range(20):
        page.wait_for_timeout(200)
        current = state(page)
        if (current["fov"] == previous["fov"] and
                all(math.isclose(current[key], previous[key], abs_tol=1e-4, rel_tol=0) for key in ("observedX", "observedY"))):
            return current
        previous = current
    raise AssertionError("The full observation projection did not settle after hiding information")


def mapped_surface_recovery(page):
    """Explicit local inspection recovers a globe and remains keyboard reachable."""
    before = state(page)
    assert before["surfaceInspection"]["supported"] and before["surfaceInspection"]["close"]
    button = page.get_by_test_id("inspect-surface")
    assert button.get_attribute("aria-pressed") == "true"
    button.press("Enter")
    page.wait_for_function("() => window.__universeObservatoryState.surfaceInspection.available && !window.__universeObservatoryState.surfaceInspection.close")
    whole = settled(page)
    assert whole["distance"] > before["distance"]
    guide_control(page, 'zoom-in').press("Enter")
    page.wait_for_function("() => window.__universeObservatoryState.surfaceInspection.available && window.__universeObservatoryState.surfaceInspection.close")
    local = settled(page)
    full_observation(page)
    assert page.get_by_test_id("star-map").evaluate("element => element === document.activeElement")
    for snapshot in (whole, local):
        for field in ("activeId", "observedId", "cameraYaw", "cameraPitch", "cameraRoll", "animationTime"):
            assert snapshot[field] == before[field], f"Surface recovery changed {field}"
    assert math.isclose(local["distance"], before["distance"], rel_tol=1e-9)
    page.get_by_test_id("restore-guide").press("Enter")
    page.wait_for_timeout(500)
    return {"wholeDistance": whole["distance"], "localDistance": local["distance"], "keyboardEntryAndRecovery": True}


def validate_state(snapshot):
    for key in ("distance", "distanceTarget", "scaleAxisProgress", "starRadiusPx", "animationTime", "motionEnergy", "fov"):
        assert isinstance(snapshot.get(key), (float, int)) and math.isfinite(snapshot[key]), key
    assert 0 <= snapshot["scaleAxisProgress"] <= 1
    assert snapshot["scaleStage"] in STAGES
    assert snapshot["distance"] > 0
    assert 0 <= snapshot["draw"] <= snapshot["catalog"]
    assert snapshot["activeId"] is not None
    assert len(snapshot.get("visibleTargets", [])) <= 24
    budget = snapshot.get("budget")
    assert isinstance(budget, dict), "diagnostics must expose effective budgets"
    assert snapshot["draw"] + sum(snapshot.get(key, 0) for key in ("planetDraw", "dwarfplanetDraw", "asteroidDraw", "nebulaDraw", "moonDraw", "galaxyDraw", "cometDraw", "pulsarDraw", "blackholeDraw", "finiteStarDraw")) <= budget["draw"]
    assert 0 <= snapshot["labels"] <= budget["labels"]
    assert 0 <= snapshot.get("galaxyStarsDraw", 0) <= budget["galaxyStars"]
    for key in ("sky", "transit", "galaxyReferences"):
        assert 0 <= snapshot["environmentDraw"][key] <= budget[key]
    for key in ("galaxyPresence", "skyPresence", "transitPresence", "immersion"):
        assert math.isfinite(snapshot["environment"][key])
        assert 0 <= snapshot["environment"][key] <= 1


def timeline(report, event, **details):
    entry = {"timeMs": round((time.monotonic() - report["timelineOrigin"]) * 1000),
             "event": event, **details}
    report["events"].append(entry)
    return entry["timeMs"]


def capture(page, name, output, report):
    snapshot = state(page)
    validate_state(snapshot)
    path = output / f"{name}.png"
    page.screenshot(path=str(path))
    report["captures"].append({"name": name, "file": str(path), "timeMs": timeline(report, "capture", name=name), "state": snapshot})
    return snapshot


def surface_sample(page, snapshot, Image):
    image = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    center_x = snapshot.get("activeX", image.width / 2)
    center_y = snapshot.get("activeY", image.height / 2)
    # Interior sample avoids labels, the silhouette and corona.
    half = min(snapshot["starRadiusPx"] * 0.22, image.width * 0.12, image.height * 0.12)
    assert half > 4, "surface state has no measurable visible body"
    box = tuple(round(value) for value in
                (center_x - half, center_y - half, center_x + half, center_y + half))
    patch = image.crop(box).resize((64, 64))
    values = [sum(pixel) / 3 for pixel in patch.getdata()]
    metrics = {"mean": statistics.mean(values), "stddev": statistics.pstdev(values),
               "range": max(values) - min(values)}
    assert metrics["mean"] > 1, f"surface is black: {metrics}"
    assert metrics["range"] > 1, f"surface interior has no visible variation: {metrics}"
    return patch, metrics


def scene_overlay_bounds(page):
    overlays = (page.locator("#debug"), page.get_by_test_id("observation-hud"))
    return [box for overlay in overlays if overlay.is_visible()
            if (box := overlay.bounding_box())]


def scene_pixel_difference(page, first, second, region, ImageChops, ImageStat, before_overlays=()):
    # Timing text and expiring operation feedback are independent of scene time.
    # Use both frames' actual overlay bounds so a disappearing hint is excluded.
    # This measurement never changes the product or its pixels.
    from PIL import ImageDraw
    mask = first.convert("L").point(lambda value: 255)
    for box in (*before_overlays, *scene_overlay_bounds(page)):
        ImageDraw.Draw(mask).rectangle((math.floor(box["x"]) - 12, math.floor(box["y"]) - 12,
                                       math.ceil(box["x"] + box["width"]) + 12,
                                       math.ceil(box["y"] + box["height"]) + 12), fill=0)
    difference = ImageChops.difference(first.crop(region), second.crop(region))
    metrics = ImageStat.Stat(difference, mask.crop(region))
    assert all(metrics.count), "The scene comparison has no sampled pixels"
    return metrics.mean


def save_observation(page, name, output, report, Image, ImageStat, pause_ms=600):
    button = page.get_by_test_id("capture-view")
    preview = page.get_by_test_id("capture-preview")
    image = page.get_by_test_id("observation-image")
    download = page.get_by_test_id("download-observation")
    assert button.get_attribute("aria-label")
    button.press("Enter")
    preview.wait_for(state="visible")
    frozen = capture(page, f"observation-{name}-preview", output, report)
    assert image.get_attribute("data-observed-id") == str(frozen["observedId"])
    assert image.get_attribute("data-active-id") == str(frozen["activeId"])
    assert image.get_attribute("data-scale-stage") == frozen["scaleStage"]
    system_view = frozen.get("systemView") or {}
    if system_view.get("visible") and not system_view.get("pending"):
        assert image.get_attribute("data-system-root-id") == str(system_view["rootId"])
        assert image.get_attribute("data-system-scope") == system_view["scope"]
    assert image.get_attribute("alt")
    source = page.get_by_test_id("target-map-source").get_attribute("href")
    if source and frozen["observedId"] == frozen["activeId"] and frozen["scaleStage"] != "Galactic" and not (frozen.get("systemView") or {}).get("visible"):
        assert source in (image.get_attribute("aria-description") or ""), "visible subject map attribution is missing from the saved image"
    shape_source = page.get_by_test_id("target-shape-source").get_attribute("href")
    if shape_source and frozen["observedId"] == frozen["activeId"] and frozen["scaleStage"] != "Galactic" and not (frozen.get("systemView") or {}).get("visible"):
        assert shape_source in (image.get_attribute("aria-description") or ""), "visible subject shape attribution is missing from the saved image"
    assert download.evaluate("element => element === document.activeElement")
    page.keyboard.press("/")
    assert not page.get_by_test_id("destinations").is_visible()
    for _ in range(3):
        page.keyboard.press("Tab")
        assert preview.evaluate("element => element.contains(document.activeElement)")
    page.keyboard.press("Shift+Tab")
    assert preview.evaluate("element => element.contains(document.activeElement)")
    page.wait_for_timeout(pause_ms)
    for field in ("distance", "cameraYaw", "cameraPitch", "animationTime", "observedId", "activeId"):
        assert state(page)[field] == frozen[field], f"preview advanced {field}"
    with page.expect_download() as pending:
        download.click()
    artifact = output / f"observation-{name}.png"
    pending.value.save_as(artifact)
    with Image.open(artifact) as png:
        assert png.format == "PNG"
        assert image.evaluate("element => element.naturalWidth") == png.width
        viewport = page.viewport_size
        scene_height = round(viewport["height"] * png.width / viewport["width"])
        assert png.height > scene_height, "observation context is missing"
        assert png.width * scene_height <= 3010000, "capture exceeded the live scene resolution budget"
        scene_pixels = png.crop((0, 0, png.width, scene_height)).convert("RGB")
        variation = ImageStat.Stat(scene_pixels)
        assert max(variation.stddev) > 1, "the exported scene is blank"
        region = frozen.get("galaxyInspection") or {}
        if region.get("settled"):
            # An internal region can put the galaxy centre offscreen or behind
            # the lens. Validate the chosen visible area and its exported identity.
            assert image.get_attribute("data-galaxy-region") == region["region"]
            area = frozen["observationArea"]
            ratio = png.width / viewport["width"]
            visible = ImageStat.Stat(scene_pixels.crop(tuple(round(v * ratio) for v in
                (area["x"], area["y"], area["x"] + area["width"], area["y"] + area["height"]))))
            assert max(visible.mean) > 1 and max(visible.stddev) > 1, "the observed galaxy region was not exported"
        elif frozen["starRadiusPx"] > 20:
            ratio = png.width / viewport["width"]
            x, y = frozen["observedX"] * ratio, frozen["observedY"] * ratio
            half = frozen["starRadiusPx"] * ratio * 0.22
            subject = ImageStat.Stat(scene_pixels.crop((round(x-half), round(y-half), round(x+half), round(y+half))))
            if frozen["observedKind"] == "blackhole":
                # This new body's centre is a dark shadow, not a luminous surface.
                # Check both darkness and its luminous surrounding structure in the actual PNG.
                from PIL import ImageDraw
                radius = frozen["starRadiusPx"] * ratio
                shadow = scene_pixels.crop((round(x-radius*.7),round(y-radius*.7),round(x+radius*.7),round(y+radius*.7)))
                assert sum(max(pixel)<6 for pixel in shadow.getdata()) / (shadow.width*shadow.height) > .5, "the black-hole shadow was not exported"
                mask = Image.new("L", scene_pixels.size)
                ink = ImageDraw.Draw(mask)
                ink.ellipse((x-radius*1.25,y-radius*1.25,x+radius*1.25,y+radius*1.25),fill=255)
                ink.ellipse((x-radius*.99,y-radius*.99,x+radius*.99,y+radius*.99),fill=0)
                ring = ImageStat.Stat(scene_pixels,mask)
                assert max(ring.mean)>1 and max(ring.stddev)>.1, "the black-hole light ring was not exported"
            else:
                assert max(subject.mean) > 1 and max(subject.stddev) > 0.1, "the actual body surface was not exported"
        details = {"file": str(artifact), "width": png.width, "height": png.height,
                   "observed": frozen["observed"], "destination": frozen["active"],
                   "scale": frozen["scaleStage"], "sceneVariation": variation.stddev,
                   "credit": image.get_attribute("aria-description"),
                   "galaxyRegion": region.get("region") if region.get("settled") else None,
                   "systemRootId": system_view.get("rootId") if system_view.get("visible") else None,
                   "systemScope": system_view.get("scope") if system_view.get("visible") else None}
    page.keyboard.press("Escape")
    preview.wait_for(state="hidden")
    page.wait_for_function("""() => {
      const button = document.querySelector('[data-testid="capture-view"]');
      return button === document.activeElement &&
        !document.querySelector('[data-testid="observation-image"]').getAttribute('src') &&
        !document.querySelector('[data-testid="download-observation"]').getAttribute('href');
    }""")
    assert button.evaluate("element => element === document.activeElement")
    assert not image.get_attribute("src") and not download.get_attribute("href")
    page.wait_for_timeout(220)
    resumed = capture(page, f"observation-{name}-resumed", output, report)
    assert resumed["activeId"] == frozen["activeId"] and resumed["observedId"] == frozen["observedId"]
    assert resumed["budget"] == frozen["budget"]
    if frozen["flight"]:
        assert resumed["flight"], "closing the preview cancelled or skipped the journey"
    details.update(previewHeld=True, keyboardExit=True, temporaryImageReleased=True, flightContinued=bool(frozen["flight"]))
    report.setdefault("observationDownloads", []).append(details)
    return resumed


def travel_inward(page, output, report, identity):
    previous = state(page)
    seen = set()
    checkpoints = iter((0.5, 0.62, 0.74, 0.82, 0.90, 0.97))
    checkpoint = next(checkpoints, None)
    page.mouse.move(700, 450)
    for step in range(240):
        current = state(page)
        validate_state(current)
        assert current["activeId"] == identity, "wheel implicitly changed focus"
        assert current["scaleAxisProgress"] >= previous["scaleAxisProgress"] - 1e-6
        assert current["distance"] <= previous["distance"] * (1 + 1e-6)
        assert STAGES.index(current["scaleStage"]) >= STAGES.index(previous["scaleStage"])
        if current["scaleStage"] not in seen:
            seen.add(current["scaleStage"])
            capture(page, current["scaleStage"].lower(), output, report)
        if checkpoint is not None and current["scaleAxisProgress"] >= checkpoint:
            capture(page, f"travel-{round(checkpoint * 100):02}", output, report)
            checkpoint = next(checkpoints, None)
        report["travel"].append({"timeMs": timeline(report, "travel-sample"), **current})
        if current["scaleAxisProgress"] >= 0.999:
            break
        delta, pause = (-110, 300) if report["recordVideo"] else (-160, 230)
        timeline(report, "wheel", deltaY=delta)
        page.mouse.wheel(0, delta)
        page.wait_for_timeout(pause)
        previous = current
    else:
        raise AssertionError("wheel did not reach the actual inward endpoint")
    assert seen == set(STAGES), f"journey missed scale stages: {set(STAGES) - seen}"
    final = settled(page)
    assert final["scaleStage"] == "Surface"
    assert final["scaleAxisProgress"] >= 0.999
    return capture(page, "surface-settled", output, report)


def run(browser, url, output, report, Image, ImageChops, ImageStat):
    errors = []
    options = {"viewport": {"width": 1400, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=output / "video", record_video_size=options["viewport"])
    page = browser.new_page(**options)
    report["timelineOrigin"] = time.monotonic()
    if page.video:
        report["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    def console_error(message):
        if message.type != "error":
            return
        location = message.location.get("url", "")
        errors.append(f"{message.text} ({location})")
    page.on("console", console_error)
    base = configured_url(url, debug=1, seed=728281, budget=report["qualityProfile"], lang="en")
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    scene = page.get_by_test_id("star-map")
    assert scene.get_attribute("role") == "application"
    assert scene.get_attribute("aria-label")
    assert scene.get_attribute("tabindex") == "0"
    assert scene.get_attribute("aria-busy") == "false"
    initial = capture(page, "initial", output, report)
    identity = initial["activeId"]
    assert initial["active"] == "Sol", "default focus should resolve the catalog Sol identity"
    assert not guide_control(page, 'next-observation').is_visible()
    report["mainJourney"] = {"startMs": timeline(report, "journey-start")}
    save_observation(page, "galaxy", output, report, Image, ImageStat)
    if report["recordVideo"]:
        page.wait_for_timeout(1250)
    surface = travel_inward(page, output, report, identity)
    idle_start = capture(page, "idle-start", output, report)
    page.wait_for_timeout(2600)
    surface = capture(page, "idle-end", output, report)
    assert surface["animationTime"] > idle_start["animationTime"]
    assert surface["rotationPhase"] > idle_start["rotationPhase"]
    report["mainJourney"]["endMs"] = timeline(report, "journey-end")
    before, metrics = surface_sample(page, surface, Image)
    report["surfacePixels"] = metrics
    center_x, center_y = surface["activeX"], surface["activeY"]
    radius = surface["starRadiusPx"]
    for dx, dy in ((0, 0), (-0.45, 0.15), (0.35, -0.4), (0.2, 0.45)):
        page.mouse.click(center_x + dx * radius, center_y + dy * radius)
        page.wait_for_timeout(220)
        assert state(page)["activeId"] == identity, "surface click selected an occluded background target"
    report["surfaceOcclusionPreserved"] = True
    page.mouse.move(630, 455)
    page.mouse.down()
    page.mouse.move(870, 385, steps=16)
    page.mouse.up()
    page.wait_for_timeout(500)
    dragged = capture(page, "surface-dragged", output, report)
    assert dragged["activeId"] == identity
    assert (dragged["cameraYaw"], dragged["cameraPitch"]) != (surface["cameraYaw"], surface["cameraPitch"])
    after, _ = surface_sample(page, dragged, Image)
    difference = statistics.mean(ImageStat.Stat(ImageChops.difference(before, after)).mean)
    report["surfaceDragPixelDifference"] = difference
    assert difference > 0.05, "drag changed state but not the visible surface"

    # A live preference change must reach both camera and GPU animation clocks.
    timeline(report, "reduced-motion", value=True)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(400)
    frozen = capture(page, "reduced-motion-start", output, report)
    page.wait_for_timeout(1400)
    held = capture(page, "reduced-motion-end", output, report)
    for key in ("animationTime", "rotationPhase", "distance", "cameraYaw", "cameraPitch", "activeX", "activeY", "fov"):
        assert math.isclose(held[key], frozen[key], rel_tol=1e-8, abs_tol=1e-7), f"reduced motion did not stop {key}"
    scene.focus()
    page.keyboard.press("-")
    manual = settled(page)
    assert manual["distance"] > frozen["distance"]
    assert manual["activeId"] == identity
    report["reducedMotionManualZoom"] = True
    page.emulate_media(reduced_motion="no-preference")
    timeline(report, "reduced-motion", value=False)

    # Keyboard controls use the same input boundary as pointer controls.
    scene.focus()
    before_key = state(page)
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(350)
    assert state(page)["cameraYaw"] != before_key["cameraYaw"]
    page.keyboard.press("-")
    page.wait_for_timeout(350)
    assert state(page)["distanceTarget"] > before_key["distanceTarget"]

    # Return through the normal wheel path, retaining the active identity.
    for _ in range(90):
        current = state(page)
        if current["scaleAxisProgress"] <= 0.001:
            break
        page.mouse.wheel(0, 700)
        page.wait_for_timeout(170)
    returned = settled(page)
    assert returned["scaleStage"] == "Galactic"
    assert returned["scaleAxisProgress"] <= 0.001
    assert returned["activeId"] == identity
    capture(page, "zoom-out", output, report)

    # Start a fresh overview before clicking a candidate; debug provides identity
    # and projected coordinates, while selection still goes through real input.
    page.reload(wait_until="networkidle")
    wait_ready(page, errors)
    page.wait_for_timeout(250)
    overview = state(page)
    candidates = [target for target in overview.get("visibleTargets", [])
                  if target["id"] != identity and 60 < target["x"] < 1320
                  and 100 < target["y"] < 800]
    assert candidates, "overview exposes no alternative selectable catalog target"
    target = max(candidates, key=lambda item: math.hypot(
        item["x"] - overview.get("activeX", 700),
        item["y"] - overview.get("activeY", 450)))
    page.mouse.click(target["x"], target["y"])
    page.wait_for_function("""id => window.__universeObservatoryState?.activeId === id""",
                           arg=target["id"], timeout=10000)
    arrival = settled(page)
    assert arrival["scaleStage"] == "Surface"
    capture(page, "selected-arrival", output, report)
    page.mouse.wheel(0, -1200)
    deeper = settled(page)
    assert deeper["activeId"] == target["id"]
    assert deeper["distance"] < arrival["distance"]
    assert deeper["starRadiusPx"] > arrival["starRadiusPx"]
    capture(page, "selected-deeper", output, report)
    scene.focus()
    page.keyboard.press("Home")
    page.wait_for_timeout(400)
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    cancelled = capture(page, "flight-cancelled", output, report)
    page.wait_for_timeout(1000)
    held = capture(page, "flight-cancelled-held", output, report)
    # Escape stops navigation, while the independent observation clock flows.
    # The observed subject keeps its screen offset; a different moving
    # destination need not keep the same projection from this held viewpoint.
    assert not held["flight"] and held["navigationState"] == "paused"
    assert (held["activeId"], held["observedId"]) == (cancelled["activeId"], cancelled["observedId"])
    for key in ("distance", "distanceTarget", "cameraYaw", "cameraPitch", "cameraRoll", "fov", "observedX", "observedY"):
        assert math.isclose(held[key], cancelled[key], rel_tol=1e-6, abs_tol=1e-5), (
            f"cancelled flight kept navigating: {key} {cancelled[key]} -> {held[key]}")
    assert held["animationTime"] > cancelled["animationTime"], "stopping navigation paused the independent activity clock"
    page.keyboard.press("Home")
    reset = settled(page)
    assert reset["scaleStage"] == "Galactic"
    assert reset["activeId"] == identity

    # A first visit can choose a meaningful destination without pixel hunting,
    # arrive, observe closer, switch targets, and return with identity intact.
    destinations = page.get_by_test_id("destinations")
    destination_toggle = page.get_by_test_id("open-destinations")
    destination_toggle.click()
    assert destinations.is_visible()
    page.keyboard.press("Escape")
    assert not destinations.is_visible()
    assert destination_toggle.evaluate("element => element === document.activeElement")
    destination_toggle.click()
    page.get_by_test_id("destination-sirius").press("Enter")
    assert not destinations.is_visible()
    page.wait_for_function("window.__universeObservatoryState?.active === 'Sirius'")
    timeline(report, "destination-journey-start")
    for name, delay in (("destination-departure", 200), ("destination-transit-1", 500),
                        ("destination-transit-2", 550), ("destination-transit-3", 550)):
        page.wait_for_timeout(delay)
        capture(page, name, output, report)
    arrival = settled(page)
    assert arrival["active"] == "Sirius" and arrival["scaleStage"] == "Surface"
    assert arrival["navigationState"] == "observing"
    assert page.get_by_test_id("target-guide").get_attribute("data-target") == "Sirius"
    capture(page, "destination-arrival", output, report)
    toggle_reading(page)
    source = page.get_by_test_id("target-details").get_by_role("link")
    assert source.is_visible() and source.get_attribute("href").startswith("https://esahubble.org/")
    toggle_reading(page)
    guide_control(page, 'zoom-in').click()
    closer = settled(page)
    assert closer["activeId"] == arrival["activeId"] and closer["distance"] < arrival["distance"]
    page.get_by_test_id("return-overview").click()
    for name, delay in (("destination-return-near", 120), ("destination-return-transit", 350),
                        ("destination-return-far", 450)):
        page.wait_for_timeout(delay)
        returning = capture(page, name, output, report)
        if returning["scaleStage"] in ("Surface", "LocalSystem", "LocalMap"):
            assert 0 <= returning["activeX"] <= 1400 and 0 <= returning["activeY"] <= 900, (
                "return lost its departure reference before leaving the nearby scales")
    returned = settled(page)
    assert returned["active"] == "Sirius" and returned["scaleStage"] == "Galactic"
    capture(page, "destination-returned", output, report)
    page.get_by_test_id("approach-target").click()
    page.wait_for_timeout(650)
    page.get_by_test_id("stop-flight").click()
    page.wait_for_timeout(350)
    stopped = state(page)
    assert stopped["navigationState"] == "paused" and not stopped["flight"]
    page.wait_for_timeout(500)
    assert math.isclose(state(page)["distance"], stopped["distance"], rel_tol=1e-7)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(250)
    destination_toggle.click()
    page.get_by_test_id("destination-proxima").click()
    proxima = settled(page)
    assert proxima["active"] == "Proxima Centauri" and proxima["scaleStage"] == "Surface"
    assert not proxima["flight"]
    page.get_by_test_id("return-overview").click()
    returned = settled(page)
    assert returned["activeId"] == proxima["activeId"] and returned["scaleStage"] == "Galactic"
    page.emulate_media(reduced_motion="no-preference")
    page.set_viewport_size({"width": 390, "height": 844})
    destination_toggle.click()
    assert destinations.is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    for key in ("destination-sol", "destination-proxima", "destination-sirius", "destination-betelgeuse"):
        assert page.get_by_test_id(key).is_visible()
    capture(page, "destination-narrow", output, report)
    page.keyboard.press("Escape")
    page.set_viewport_size({"width": 1400, "height": 900})
    report["destinationJourney"] = {"identityPreservedOnReturn": True, "keyboardSelection": True,
                                    "stoppedFlightHolds": True, "reducedMotion": True, "narrowViewport": True}
    timeline(report, "destination-journey-end")

    # Collect colour and surface evidence for comparative visual review. These
    # measurements do not prescribe a palette, texture recipe or pixel threshold.
    report["stellarComparison"] = []
    for key, name in (("sol", "Sol"), ("proxima", "Proxima Centauri"),
                      ("sirius", "Sirius"), ("betelgeuse", "Betelgeuse")):
        destination_toggle.click()
        page.get_by_test_id(f"destination-{key}").click()
        arrival = settled(page)
        assert arrival["active"] == name and arrival["scaleStage"] == "Surface"
        capture(page, f"compare-{key}", output, report)
        patch, metrics = surface_sample(page, arrival, Image)
        report["stellarComparison"].append({"target": name, "meanRGB": ImageStat.Stat(patch).mean,
                                            "variation": metrics, "frameMs": arrival["frameMs"],
                                            "draw": arrival["draw"], "budget": arrival["budget"]})

    # A close transfer leaves the visible body before crossing to a new one.
    # Selection and observation identities are independent while in flight.
    transfers = []
    page.get_by_test_id("hide-guide").click()
    timeline(report, "interstellar-journey-start")
    for key, name in (("sol", "Sol"), ("sirius", "Sirius"), ("betelgeuse", "Betelgeuse")):
        if key == "betelgeuse":
            page.set_viewport_size({"width": 390, "height": 844})
            page.wait_for_timeout(350)
        origin = state(page)
        destination_toggle.click()
        page.get_by_test_id(f"destination-{key}").click()
        page.wait_for_function("""origin => {
          const s = window.__universeObservatoryState;
          return s?.flightPhase === 'departing' && s.observedId === origin;
        }""", arg=origin["activeId"])
        departure = capture(page, f"transfer-{key}-departure", output, report)
        assert departure["active"] == name and departure["observedId"] == origin["activeId"]
        assert departure["starRadiusPx"] > 4, "the departure remains a visible body"
        assert scene.get_attribute("data-observed-id") == str(origin["activeId"])
        assert scene.get_attribute("aria-label")
        assert page.get_by_test_id("stop-flight").is_visible()
        if key == "sol":
            resumed = save_observation(page, "departure", output, report, Image, ImageStat, pause_ms=2000)
            assert resumed["flightPhase"] == "departing", "preview time leaked into the flight clock"
        page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'crossing'")
        crossing = capture(page, f"transfer-{key}-crossing", output, report)
        assert crossing["observedId"] == crossing["activeId"]
        page.wait_for_function("""() => {
          const s = window.__universeObservatoryState;
          return s?.flightPhase === 'approaching' && s.starRadiusPx > 6;
        }""")
        capture(page, f"transfer-{key}-approach", output, report)
        arrived = settled(page)
        assert arrived["active"] == name and arrived["observedId"] == arrived["activeId"]
        assert arrived["scaleStage"] == "Surface" and arrived["budget"] == initial["budget"]
        capture(page, f"transfer-{key}-arrival", output, report)
        transfers.append({"origin": origin["active"], "destination": name,
                          "departurePreserved": True, "handoverAtDistance": True,
                          "arrived": True, "budget": arrived["budget"]})
    page.set_viewport_size({"width": 1400, "height": 900})
    page.wait_for_timeout(350)
    origin = state(page)
    destination_toggle.click()
    page.get_by_test_id("destination-sirius").click()
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    page.get_by_test_id("stop-flight").click()
    page.wait_for_timeout(300)
    held = state(page)
    assert held["navigationState"] == "paused" and held["observedId"] == origin["activeId"]
    page.wait_for_timeout(450)
    for field in ("distance", "cameraYaw", "cameraPitch", "observedId"):
        assert math.isclose(state(page)[field], held[field], rel_tol=1e-7, abs_tol=1e-7)
    page.get_by_test_id("lens-in").click()
    directed = settled(page)
    assert directed["observedId"] == held["observedId"] and directed["activeId"] == held["activeId"]
    assert directed["distance"] < held["distance"]
    capture(page, "transfer-stopped-observation", output, report)
    page.get_by_test_id("return-overview").click()
    returned = settled(page)
    assert returned["activeId"] == held["activeId"] and returned["scaleStage"] == "Galactic"
    page.get_by_test_id("restore-guide").click()
    page.get_by_test_id("approach-target").click()
    assert settled(page)["active"] == "Sirius"
    # Reduced motion goes straight to the destination rather than starting a route.
    page.emulate_media(reduced_motion="reduce")
    destination_toggle.click()
    page.get_by_test_id("destination-sol").click()
    reduced_transfer = settled(page)
    assert reduced_transfer["active"] == "Sol" and reduced_transfer["observedId"] == reduced_transfer["activeId"]
    assert not reduced_transfer["flight"] and reduced_transfer["motionEnergy"] == 0
    page.emulate_media(reduced_motion="no-preference")
    report["interstellarFlight"] = {"transfers": transfers, "stoppedObservationPreserved": True,
                                   "directNavigation": True, "returnAndResume": True,
                                   "reducedMotion": True, "narrowViewport": True}
    timeline(report, "interstellar-journey-end")

    # Intentional scale exploration is available to pointer and keyboard users,
    # independent of a star's size and without implicitly selecting another star.
    scale_identity = state(page)["activeId"]
    timeline(report, "scale-navigation-start")
    for stage in STAGES:
        stop = page.get_by_test_id(f"scale-{stage}")
        stop.click()
        reached = settled(page)
        assert reached["activeId"] == scale_identity and reached["scaleStage"] == stage
        assert stop.get_attribute("aria-current") == "true"
        capture(page, f"scale-nav-{stage.lower()}", output, report)
    slider = page.get_by_test_id("scale-slider")
    assert slider.get_attribute("aria-label") and slider.get_attribute("aria-orientation") in ("horizontal", "vertical")
    slider.press("Home")
    outer = settled(page)
    assert outer["scaleAxisProgress"] <= 0.001 and outer["activeId"] == scale_identity
    slider.press("End")
    inner = settled(page)
    assert inner["scaleAxisProgress"] >= 0.999 and inner["activeId"] == scale_identity
    slider.press("ArrowDown")
    backed = settled(page)
    assert backed["distance"] > inner["distance"] and backed["activeId"] == scale_identity
    page.get_by_test_id("scale-Galactic").click()
    settled(page)
    page.get_by_test_id("scale-Surface").click()
    page.get_by_test_id("stop-flight").wait_for(state="visible", timeout=2000)
    page.get_by_test_id("stop-flight").click()
    page.wait_for_timeout(350)
    paused = state(page)
    assert paused["navigationState"] == "paused"
    page.wait_for_timeout(500)
    assert math.isclose(state(page)["distance"], paused["distance"], rel_tol=1e-7)
    scrub_scale(page)
    dragged = settled(page)
    assert dragged["activeId"] == scale_identity and dragged["navigationState"] == "observing"
    assert not math.isclose(dragged["distance"], paused["distance"], rel_tol=1e-3)
    capture(page, "scale-slider-dragged", output, report)
    page.emulate_media(reduced_motion="reduce")
    page.get_by_test_id("scale-LocalMap").click()
    reduced = settled(page)
    assert reduced["activeId"] == scale_identity and reduced["scaleStage"] == "LocalMap"
    assert reduced["motionEnergy"] == 0
    page.emulate_media(reduced_motion="no-preference")
    report["scaleNavigation"] = {"namedStages": True, "keyboardEndpoints": True,
                                 "pointerScrub": True, "cancelAndResume": True,
                                 "identityPreserved": True, "reducedMotion": True}
    timeline(report, "scale-navigation-end")

    # A chosen named star can be found without navigating by tiny pixels.
    scene.focus()
    page.keyboard.press("/")
    search = page.get_by_test_id("star-search")
    assert search.is_visible() and search.evaluate("element => element === document.activeElement")
    search.fill("vEgA")
    vega = destinations.locator('button[data-target="Vega"]:visible')
    assert vega.is_visible()
    capture(page, "search-vega", output, report)
    search.press("ArrowDown")
    page.keyboard.press("Enter")
    arrival = settled(page)
    assert arrival["active"] == "Vega" and arrival["scaleStage"] == "Surface"
    assert not destinations.is_visible()
    assert scene.evaluate("element => element === document.activeElement")
    capture(page, "search-vega-arrived", output, report)
    # Observing a named star provides a reason and a direct route to a contrast.
    recommendation = guide_control(page, 'next-observation')
    assert recommendation.is_visible() and recommendation.get_attribute("data-target") == "Sol"
    assert recommendation.inner_text().strip()
    toggle_reading(page)
    assert page.get_by_test_id("target-source").get_attribute("href").startswith("https://")
    capture(page, "vega-content", output, report)
    toggle_reading(page)
    scene.press("Escape")
    page.wait_for_timeout(250)
    assert state(page)["navigationState"] == "paused" and recommendation.is_visible()
    recommendation.press("Enter")
    assert scene.evaluate("element => element === document.activeElement")
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    assert not recommendation.is_visible()
    page.get_by_test_id("stop-flight").click()
    page.wait_for_timeout(300)
    comparison_paused = state(page)
    assert comparison_paused["active"] == "Sol" and comparison_paused["observed"] == "Vega"
    assert comparison_paused["navigationState"] == "paused" and not recommendation.is_visible()
    capture(page, "comparison-stopped", output, report)
    page.get_by_test_id("approach-target").click()
    assert settled(page)["active"] == "Sol"
    assert recommendation.get_attribute("data-target") == "Betelgeuse"
    recommendation.click()
    assert settled(page)["active"] == "Betelgeuse"
    capture(page, "comparison-giant-arrived", output, report)
    page.get_by_test_id("return-overview").click()
    assert settled(page)["active"] == "Betelgeuse" and not recommendation.is_visible()
    scene.focus()
    page.keyboard.press("/")
    search.fill("Vega")
    search.press("Enter")
    arrival = settled(page)
    report["observationComparison"] = {"sourcedSearchTarget": True, "keyboardSelect": True,
                                       "stopAndResume": True, "chainedVisits": True,
                                       "returnPreservesTarget": True}
    # Reading and unobstructed observation share one camera and target.
    information = page.get_by_test_id("target-guide")
    hide_info = page.get_by_test_id("hide-guide")
    show_info = page.get_by_test_id("restore-guide")
    hide_info.press("Enter")
    assert not information.is_visible() and show_info.is_visible()
    assert show_info.evaluate("element => element === document.activeElement")
    page.wait_for_timeout(350)
    observing = state(page)
    for key in ("activeId", "distanceTarget", "cameraYaw", "cameraPitch"):
        assert math.isclose(observing[key], arrival[key], rel_tol=1e-7, abs_tol=1e-7)
    assert page.get_by_test_id("position-readout").is_visible()
    assert page.get_by_test_id("scale-slider").is_visible()
    capture(page, "unobstructed-observation", output, report)
    scene.focus()
    scene.press("ArrowLeft")
    page.wait_for_timeout(350)
    assert not math.isclose(state(page)["cameraYaw"], observing["cameraYaw"], abs_tol=1e-3)
    page.get_by_test_id("lens-in").click()
    deeper_observation = settled(page)
    assert deeper_observation["distance"] < observing["distance"]
    capture(page, "unobstructed-deeper", output, report)
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(400)
    capture(page, "unobstructed-narrow", output, report)
    page.get_by_test_id("return-overview").click()
    assert settled(page)["activeId"] == arrival["activeId"]
    destination_toggle.click()
    page.get_by_test_id("destination-sol").click()
    assert settled(page)["active"] == "Sol"
    assert not information.is_visible()
    show_info.press("Enter")
    assert information.is_visible() and not show_info.is_visible()
    assert hide_info.evaluate("element => element === document.activeElement")
    assert information.get_attribute("data-target") == "Sol"
    toggle_reading(page)
    assert page.get_by_test_id("target-source").is_visible()
    capture(page, "observation-information-restored", output, report)
    toggle_reading(page)
    page.set_viewport_size({"width": 1400, "height": 900})
    destination_toggle.click()
    page.get_by_test_id("star-search").fill("Vega")
    destinations.locator('button[data-target="Vega"]:visible').click()
    arrival = settled(page)
    report["observationInformation"] = {"keyboardHideAndRestore": True, "cameraPreserved": True,
                                      "controlsRemainReachable": True, "hiddenTargetSwitch": True,
                                      "currentInformationRestored": True, "narrowViewport": True}
    page.get_by_test_id("return-overview").click()
    assert settled(page)["activeId"] == arrival["activeId"]
    destination_toggle.click()
    search.fill("not a catalog star")
    assert page.get_by_test_id("destination-empty").is_visible()
    unchanged = state(page)
    search.press("Enter")
    page.wait_for_timeout(300)
    assert state(page)["activeId"] == unchanged["activeId"]
    assert state(page)["distanceTarget"] == unchanged["distanceTarget"]
    page.keyboard.press("Escape")
    assert not destinations.is_visible()
    assert destination_toggle.evaluate("element => element === document.activeElement")
    report["starSearch"] = {"keyboardOpenAndSelect": True, "canonicalCaseInsensitive": True,
                          "unknownQueryDoesNotNavigate": True, "returnPreservesIdentity": True}

    page.goto(configured_url(base, lang="zh", catalog=50000), wait_until="networkidle")
    wait_ready(page, errors)
    stressed = capture(page, "large-catalog-zh", output, report)
    assert stressed["catalog"] == 50000
    assert stressed["activeId"] == identity
    assert stressed["budget"] == initial["budget"]
    assert page.locator("html").get_attribute("lang").startswith("zh")
    assert page.get_by_test_id("star-map").get_attribute("aria-label")
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("star-search").fill("参宿四")
    page.get_by_test_id("destination-betelgeuse").click()
    betelgeuse = settled(page)
    assert betelgeuse["active"] == "Betelgeuse"
    assert page.get_by_test_id("target-guide").get_attribute("data-target") == "Betelgeuse"
    capture(page, "destination-zh", output, report)
    page.set_viewport_size({"width": 390, "height": 844})
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(350)
    save_observation(page, "surface-zh-narrow", output, report, Image, ImageStat)
    assert guide_control(page, 'next-observation').is_visible()
    recommended = guide_control(page, 'next-observation').get_attribute("data-target")
    assert recommended and recommended != betelgeuse["active"]
    guide_control(page, 'next-observation').press("Enter")
    compared_reduced = settled(page)
    assert compared_reduced["active"] == compared_reduced["observed"] == recommended and not compared_reduced["flight"]
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("star-search").fill("织女")
    page.get_by_test_id("destination-vega").press("Enter")
    assert settled(page)["active"] == "Vega"
    capture(page, "comparison-zh-narrow", output, report)
    report["observationComparison"].update(bilingualAlias=True, narrowViewport=True, reducedMotion=True)
    assert not errors, f"browser errors: {errors}"
    report["browserErrors"] = errors
    page.close()

    # Output failure must release the Worker pause and leave exploration usable.
    capture_failure = browser.new_page(viewport={"width": 900, "height": 600})
    capture_failure.on("pageerror", lambda error: errors.append(str(error)))
    capture_failure.add_init_script("HTMLCanvasElement.prototype.toBlob = function(callback) { setTimeout(() => callback(null), 0); }")
    capture_failure.goto(base, wait_until="networkidle")
    wait_ready(capture_failure, errors)
    before_failure = state(capture_failure)
    capture_failure.get_by_test_id("capture-view").click()
    capture_failure.wait_for_function("""before => {
      const s = window.__universeObservatoryState;
      return s?.animationTime > before + 0.3 &&
        !document.querySelector('[data-testid="capture-view"]').disabled;
    }""", arg=before_failure["animationTime"])
    assert not capture_failure.get_by_test_id("capture-preview").is_visible()
    assert not capture_failure.get_by_test_id("download-observation").get_attribute("href")
    assert capture_failure.locator("#status").inner_text().strip()
    assert state(capture_failure)["activeId"] == before_failure["activeId"]
    capture_failure.screenshot(path=str(output / "observation-failure-recovered.png"))
    report["observationFailureRecovered"] = True
    capture_failure.close()
    assert not errors, f"browser errors: {errors}"

    fallback = browser.new_page(viewport={"width": 900, "height": 600})
    fallback.add_init_script("delete Navigator.prototype.gpu")
    fallback.goto(base, wait_until="networkidle")
    assert not fallback.evaluate("'gpu' in navigator"), "capability simulation did not take effect"
    fallback.wait_for_function("document.querySelector('#observatory')?.dataset.state === 'unavailable'")
    assert fallback.get_by_role("alert").is_visible()
    assert fallback.get_by_role("alert").inner_text().strip()
    fallback.screenshot(path=str(output / "capability-unavailable.png"))
    report["capabilityFailureVisible"] = True
    fallback.close()



def run_planets(browser, url, output, report, Image, ImageChops, ImageStat):
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["planetJourney"] = evidence
    errors = []
    options = {"viewport": {"width": 1400, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=output / "planet-video", record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, seed=728281, budget=report["qualityProfile"], lang="en", target="Sol")
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").click()
    settled(page)
    capture(page, "planet-departure-sun", output, evidence)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("destination-earth").press("Enter")
    page.wait_for_timeout(280)
    leaving = capture(page, "earth-departing", output, evidence)
    assert leaving["active"] == "Earth" and leaving["observed"] == "Sol"
    assert leaving["activeKind"] == "planet" and leaving["observedKind"] == "star"
    page.get_by_test_id("star-map").press("Escape")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    stopped = capture(page, "earth-stopped-near-sun", output, evidence)
    assert stopped["observed"] == "Sol" and stopped["active"] == "Earth"
    page.get_by_test_id("approach-target").click()
    for name, delay in (("earth-departure-resumed", 550), ("earth-crossing", 900), ("earth-approaching", 1650)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    earth = settled(page)
    assert earth["active"] == earth["observed"] == "Earth" and earth["scaleStage"] == "Surface"
    assert earth["draw"] + earth["planetDraw"] + earth.get("nebulaDraw", 0) <= earth["budget"]["draw"]
    earth_image, earth_metrics = surface_sample(page, earth, Image)
    capture(page, "earth-arrived", output, evidence)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(450)
    frozen_a = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    fixed = state(page)
    page.wait_for_timeout(600)
    frozen_b = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    half = int(fixed["starRadiusPx"] * .9)
    x, y = int(fixed["observedX"]), int(fixed["observedY"])
    box = (x-half, y-half, x+half, y+half)
    cloud_freeze = ImageStat.Stat(ImageChops.difference(frozen_a.crop(box), frozen_b.crop(box))).mean
    assert max(cloud_freeze) < .05, "Earth cloud or ground animation continued with reduced motion"
    evidence["earthReducedPixelDifference"] = cloud_freeze
    page.emulate_media(reduced_motion="no-preference")
    toggle_reading(page)
    source = page.get_by_test_id("target-details").get_by_role("link")
    assert source.is_visible() and source.get_attribute("href") == "https://science.nasa.gov/earth/facts/"
    save_observation(page, "earth", output, evidence, Image, ImageStat, pause_ms=450)
    page.get_by_test_id("hide-guide").click()
    scene = page.get_by_test_id("star-map")
    scene.focus()
    for _ in range(6):
        scene.press("ArrowLeft")
    page.wait_for_timeout(500)
    turned = capture(page, "earth-lighting-orbit", output, evidence)
    rotated_image, _ = surface_sample(page, turned, Image)
    difference = ImageStat.Stat(ImageChops.difference(earth_image, rotated_image)).mean
    assert max(difference) > 0.5, "Earth orbit did not change the actual observed surface"
    scene.press("Escape")
    page.get_by_test_id("restore-guide").click()
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("destination-saturn").press("Enter")
    for name, delay in (("saturn-departing", 400), ("saturn-crossing", 1100), ("saturn-approaching", 1500)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    saturn = settled(page)
    assert saturn["active"] == saturn["observed"] == "Saturn" and saturn["scaleStage"] == "Surface"
    assert saturn["bodyExtentPx"] > saturn["starRadiusPx"]
    _, saturn_metrics = surface_sample(page, saturn, Image)
    capture(page, "saturn-arrived", output, evidence)
    ring = saturn["ringPoint"]
    assert ring["visible"]
    page.mouse.move(ring["x"], ring["y"])
    page.wait_for_function("window.__universeObservatoryState?.hoveredId === window.__universeObservatoryState?.observedId")
    page.mouse.click(ring["x"], ring["y"])
    assert state(page)["activeId"] == saturn["activeId"]
    page.get_by_test_id("hide-guide").click()
    for label, key in (("saturn-below-rings", "ArrowUp"), ("saturn-above-rings", "ArrowDown")):
        for _ in range(9 if key == "ArrowUp" else 18):
            scene.press(key)
        page.wait_for_timeout(450)
        capture(page, label, output, evidence)
    scene.press("Escape")
    frozen = state(page)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(450)
    reduced = state(page)
    page.wait_for_timeout(450)
    assert state(page)["animationTime"] == reduced["animationTime"]
    assert reduced["observedId"] == frozen["observedId"]
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("destination-earth").click()
    assert settled(page)["observed"] == "Earth"
    page.emulate_media(reduced_motion="no-preference")
    page.goto(configured_url(base, lang="zh", target="Saturn"), wait_until="networkidle")
    wait_ready(page, errors)
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("star-search").fill("土星")
    page.get_by_test_id("destination-saturn").press("Enter")
    narrow = settled(page)
    assert narrow["observed"] == "Saturn"
    capture(page, "saturn-zh-narrow", output, evidence)
    save_observation(page, "saturn-narrow", output, evidence, Image, ImageStat, pause_ms=400)
    page.get_by_test_id("return-overview").click()
    for name, delay in (("planet-return-near", 150), ("planet-return-system", 450), ("planet-return-map", 650)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    returned = settled(page)
    assert returned["activeId"] == returned["observedId"] == saturn["activeId"]
    assert returned["scaleStage"] == "Galactic"
    page.close()
    evidence.update(status="passed", errors=errors, earthSurface=earth_metrics, saturnSurface=saturn_metrics,
                    orbitPixelDifference=difference, ringPicked=True, mixedTransferStopped=True,
                    reducedMotion=True, narrowAndChinese=True, returnedWithIdentity=True)
    assert not errors, errors


def run_solar(browser, url, output, report, Image, ImageChops, ImageStat):
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["solarJourney"] = evidence
    errors = []
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=output / "solar-video", record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, lang="en", target="Earth", budget=report["qualityProfile"])
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").press("Enter")
    home = settled(page)
    capture(page, "solar-home-earth", output, evidence)
    assert guide_control(page, 'next-observation').get_attribute("data-target") == "Mars"
    timeline(evidence, "earth-mars-start")
    guide_control(page, 'next-observation').press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    leaving = capture(page, "mars-departing-earth", output, evidence)
    assert leaving["active"] == "Mars" and leaving["observed"] == "Earth"
    page.get_by_test_id("star-map").press("Escape")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    held = state(page)
    page.wait_for_timeout(550)
    stopped = capture(page, "mars-stopped-near-earth", output, evidence)
    assert stopped["observedId"] == home["observedId"] and stopped["active"] == "Mars"
    for field in ("distance", "cameraYaw", "cameraPitch"):
        assert math.isclose(stopped[field], held[field], rel_tol=1e-8, abs_tol=1e-8), field
    page.get_by_test_id("approach-target").press("Enter")
    for name, delay in (("mars-departure-resumed", 450), ("mars-crossing", 950), ("mars-approaching", 1350)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    arrived = settled(page)
    timeline(evidence, "earth-mars-end")
    assert arrived["active"] == arrived["observed"] == "Mars"
    assert arrived["activeKind"] == "planet" and arrived["scaleStage"] == "Surface"
    identity = arrived["observedId"]
    capture(page, "mars-arrived", output, evidence)
    toggle_reading(page)
    links = page.get_by_test_id("target-details").get_by_role("link")
    assert links.count() == 2
    assert links.nth(0).get_attribute("href") == "https://science.nasa.gov/mars/facts/"
    assert page.get_by_test_id("target-map-source").get_attribute("href") == "https://www.solarsystemscope.com/textures/"
    capture(page, "mars-sources", output, evidence)
    page.get_by_test_id("hide-guide").press("Enter")
    save_observation(page, "mars", output, evidence, Image, ImageStat, pause_ms=400)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(400)
    fixed = state(page)
    before, metrics = surface_sample(page, fixed, Image)
    page.wait_for_timeout(650)
    after, _ = surface_sample(page, state(page), Image)
    frozen_difference = ImageStat.Stat(ImageChops.difference(before, after)).mean
    assert max(frozen_difference) < .05, "Mars changed without input under reduced motion"
    profiles = []
    for key in ("safe", "immersive"):
        page.get_by_test_id("open-quality").press("Enter")
        radio = page.get_by_test_id(f"quality-{key}")
        if not radio.is_checked():
            radio.check()
            page.wait_for_function("key => window.__universeObservatoryState?.quality?.key === key", arg=key)
        page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
        page.keyboard.press("Escape")
        current = settled(page)
        assert current["observedId"] == current["activeId"] == identity
        for field in ("distance", "cameraYaw", "cameraPitch", "animationTime"):
            assert math.isclose(current[field], fixed[field], rel_tol=1e-8, abs_tol=1e-8), field
        quality = current["quality"]
        assert 0 < quality["marsTextureWidth"] <= 4096
        assert quality["width"] * quality["height"] <= quality["pixelLimit"]
        profiles.append(quality)
        capture(page, f"mars-quality-{key}", output, evidence)
    assert profiles[0]["marsTextureWidth"] < profiles[1]["marsTextureWidth"]
    scene = page.get_by_test_id("star-map")
    for _ in range(7):
        scene.press("ArrowLeft")
    page.wait_for_timeout(350)
    orbited = capture(page, "mars-day-night-orbit", output, evidence)
    turned, _ = surface_sample(page, orbited, Image)
    orbit_difference = ImageStat.Stat(ImageChops.difference(after, turned)).mean
    assert max(orbit_difference) > .5, "Mars orbit had no visual response"
    slider = page.get_by_test_id("scale-slider")
    slider.focus()
    slider.press("End")
    close = settled(page)
    assert close["starRadiusPx"] > arrived["starRadiusPx"] and close["observedId"] == identity
    capture(page, "mars-close", output, evidence)
    page.get_by_test_id("restore-guide").press("Enter")
    assert guide_control(page, 'next-observation').get_attribute("data-target") == "Earth"
    page.emulate_media(reduced_motion="no-preference")
    timeline(evidence, "mars-earth-start")
    guide_control(page, 'next-observation').press("Enter")
    page.wait_for_timeout(400)
    capture(page, "mars-returning-home", output, evidence)
    returned = settled(page)
    timeline(evidence, "mars-earth-end")
    assert returned["observedId"] == returned["activeId"] == home["observedId"]
    capture(page, "solar-home-again", output, evidence)
    guide_section(page, 'related')
    relations = page.get_by_test_id("body-relations")
    relations.locator('button[data-target="Sol"]:visible').press("Enter")
    assert settled(page)["observed"] == "Sol"
    guide_section(page, 'related')
    relations.locator('button[data-target="Mars"]:visible').press("Enter")
    assert settled(page)["observedId"] == identity
    expanded_visits = []
    for target, planet_id, query, source in [
        ("Mercury", 50010, "水星", "https://science.nasa.gov/mercury/facts/"),
        ("Venus", 50011, "金星", "https://science.nasa.gov/venus/venus-facts/"),
        ("Uranus", 50012, "天王星", "https://science.nasa.gov/uranus/facts/"),
        ("Neptune", 50013, "海王星", "https://science.nasa.gov/neptune/neptune-facts/")]:
        for language, search in [("en", target), ("zh", query)]:
            page.goto(configured_url(base, lang=language, target="Sol"), wait_until="networkidle")
            wait_ready(page, errors)
            page.get_by_test_id("open-destinations").press("Enter")
            page.get_by_test_id("browse-planet").press("Enter")
            page.get_by_test_id("star-search").fill(search)
            result=page.get_by_test_id("destinations").locator(f'button[data-target="{target}"]:visible')
            assert result.count()==1
            timeline(evidence,"expanded-solar-start",target=target,language=language)
            result.press("Enter")
            whole=settled(page)
            assert whole["observedId"]==whole["activeId"]==planet_id and whole["activeKind"]=="planet"
            capture(page,f"{target.lower()}-{language}-arrival",output,evidence)
            toggle_reading(page)
            assert page.get_by_test_id("target-details").get_by_role("link").first.get_attribute("href")==source
            guide_section(page, 'related')
            page.get_by_test_id("body-relations").locator('button[data-target="Sol"]:visible').wait_for()
            page.get_by_test_id("hide-guide").press("Enter");full_observation(page)
            whole=settled(page)
            page.get_by_test_id("scale-slider").press("End");close=settled(page)
            assert close["distance"]<whole["distance"] and close["starRadiusPx"]>whole["starRadiusPx"]
            assert close["fov"]==whole["fov"] and close["observedId"]==planet_id
            capture(page,f"{target.lower()}-{language}-close",output,evidence)
            page.get_by_test_id("open-dynamics").press("Enter")
            page.get_by_test_id("motion-paused").check();page.keyboard.press("Escape")
            page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.rate===0")
            frozen=settled(page)
            page.get_by_test_id("star-map").press("ArrowRight");page.get_by_test_id("star-map").press("Escape")
            held=settled(page)
            assert held["animationTime"]==frozen["animationTime"] and held["observedId"]==planet_id
            capture(page,f"{target.lower()}-{language}-paused-orbit",output,evidence)
            if language=="zh" and target in ["Mercury","Uranus"]:
                save_observation(page,target.lower(),output,evidence,Image,ImageStat,pause_ms=300)
            page.get_by_test_id("return-overview").press("Enter");returned=settled(page)
            assert returned["activeId"]==returned["observedId"]==planet_id and returned["scaleStage"]=="Galactic"
            capture(page,f"{target.lower()}-{language}-return",output,evidence)
            timeline(evidence,"expanded-solar-end",target=target,language=language)
            expanded_visits.append({"id":planet_id,"language":language,"pauseRetainsClock":True,"fixedLens":True,"returnedWithIdentity":True})
    evidence["expandedSolarVisits"]=expanded_visits
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(configured_url(base, lang="zh", target="mars"), wait_until="networkidle")
    wait_ready(page, errors)
    assert state(page)["activeId"] == identity
    page.get_by_test_id("open-destinations").press("Enter")
    page.get_by_test_id("star-search").fill("火星")
    found = page.get_by_test_id("destinations").locator('button[data-target="Mars"]:visible')
    assert found.count() == 1
    found.press("Enter")
    assert settled(page)["observedId"] == identity
    capture(page, "mars-zh-narrow", output, evidence)
    toggle_reading(page)
    map_source = page.get_by_test_id("target-map-source")
    map_source.focus()
    box = map_source.bounding_box()
    assert 0 <= box["y"] and box["y"] + box["height"] <= 844
    capture(page, "mars-zh-map-source", output, evidence)
    save_observation(page, "mars-narrow", output, evidence, Image, ImageStat, pause_ms=300)
    page.get_by_test_id("return-overview").press("Enter")
    assert settled(page)["activeId"] == identity
    assert state(page)["scaleStage"] == "Galactic"
    capture(page, "mars-return-map", output, evidence)
    page.close()
    evidence.update(status="passed", errors=errors, marsSurface=metrics, orbitPixelDifference=orbit_difference,
                    reducedPixelDifference=frozen_difference, qualityProfiles=profiles, departureStopped=True,
                    earthMarsReturn=True, sourceAndMapAttribution=True, solarRelations=True,
                    narrowChineseSearch=True, directTargetIdentity=True, returnedWithIdentity=True)
    assert not errors, errors


def run_galaxies(browser, url, output, report, Image, ImageChops, ImageStat):
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["galaxyJourney"] = evidence
    errors = []
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=output / "galaxy-video", record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, lang="en", target="Earth", budget=report["qualityProfile"])
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    page.get_by_test_id("hide-guide").click()
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("star-search").fill("M 31")
    page.get_by_test_id("destination-andromeda").press("Enter")
    page.get_by_test_id("stop-flight").click()
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    stopped = capture(page, "galaxy-stopped-near-earth", output, evidence)
    assert stopped["active"] == "Andromeda Galaxy" and stopped["observed"] == "Earth"
    page.get_by_test_id("resume-flight").press("Enter")
    timeline(evidence, "galaxy-approach-start")
    for name, delay in (("galaxy-departure", 350), ("galaxy-crossing", 1200), ("galaxy-approaching", 1400)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    arrived = settled(page)
    identity = arrived["activeId"]
    assert arrived["activeId"] == arrived["observedId"] and arrived["observedKind"] == "galaxy"
    assert arrived["scaleStage"] == "Surface"
    capture(page, "galaxy-arrived", output, evidence)
    timeline(evidence, "galaxy-approach-complete")
    page.get_by_test_id("restore-guide").click()
    toggle_reading(page)
    source = page.get_by_test_id("target-details").get_by_role("link")
    assert source.get_attribute("href") == "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/"
    toggle_reading(page)
    page.get_by_test_id("hide-guide").click()
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(300)
    orientation = [state(page)[key] for key in ("cameraYaw", "cameraPitch", "cameraRoll", "fov")]
    for stage in STAGES:
        page.get_by_test_id(f"scale-{stage}").press("Enter")
        current = settled(page)
        assert current["scaleStage"] == stage
        assert current["activeId"] == current["observedId"] == identity
        assert [current[key] for key in ("cameraYaw", "cameraPitch", "cameraRoll", "fov")] == orientation
        assert math.isclose(current["observedX"], 640, abs_tol=.1) and math.isclose(current["observedY"], 360, abs_tol=.1)
        capture(page, f"galaxy-scale-{stage.lower()}", output, evidence)
    scene = page.get_by_test_id("star-map")
    scene.focus()
    timeline(evidence, "galaxy-orbit-start")
    for _ in range(10):
        scene.press("ArrowDown")
    page.wait_for_timeout(300)
    capture(page, "galaxy-face", output, evidence)
    face = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    for _ in range(16):
        scene.press("ArrowUp")
    page.wait_for_timeout(300)
    capture(page, "galaxy-edge", output, evidence)
    edge = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    difference = ImageStat.Stat(ImageChops.difference(face, edge)).mean
    assert max(difference) > .5, "galaxy orientation produced no visual response"
    timeline(evidence, "galaxy-orbit-complete")
    for _ in range(4):
        scene.press("ArrowDown")
    page.emulate_media(reduced_motion="no-preference")
    timeline(evidence, "galaxy-drag-start")
    page.mouse.move(730, 300)
    page.mouse.down()
    for step in range(1, 33):
        page.mouse.move(730 + step * 4, 300 + step)
        page.wait_for_timeout(30)
    page.mouse.up()
    page.wait_for_timeout(500)
    capture(page, "galaxy-dragged", output, evidence)
    timeline(evidence, "galaxy-drag-complete")
    timeline(evidence, "galaxy-close-start")
    for step in range(12):
        page.mouse.wheel(0, -85)
        page.wait_for_timeout(180)
        if step in (2, 6, 11):
            capture(page, f"galaxy-close-step-{step}", output, evidence)
    closest = settled(page)
    assert closest["distance"] < arrived["distance"] and closest["observedId"] == identity
    capture(page, "galaxy-closest", output, evidence)
    timeline(evidence, "galaxy-close-complete")
    # Exact pose preservation requires the preceding user zoom to have finished.
    page.wait_for_function("""() => {const s=window.__universeObservatoryState;
      return s && !s.flight && s.distance===s.distanceTarget;}""")
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(300)
    frozen = state(page)
    first = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    page.wait_for_timeout(500)
    second = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    frozen_difference = ImageStat.Stat(ImageChops.difference(first, second)).mean
    assert state(page)["animationTime"] == frozen["animationTime"]
    assert max(frozen_difference) < .05
    profiles = []
    for key in ("safe", "standard", "immersive"):
        page.get_by_test_id("open-quality").click()
        page.get_by_test_id(f"quality-{key}").check()
        page.wait_for_function("key => window.__universeObservatoryState?.quality?.key === key", arg=key)
        page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
        page.keyboard.press("Escape")
        current = settled(page)
        validate_state(current)
        for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll"):
            assert current[field] == frozen[field]
        profiles.append({"quality": current["quality"], "stars": current["galaxyStarsDraw"]})
        capture(page, f"galaxy-quality-{key}", output, evidence)
    save_observation(page, "galaxy", output, evidence, Image, ImageStat, pause_ms=300)
    page.get_by_test_id("scale-Surface").press("Enter")
    settled(page)
    page.wait_for_function("Math.abs(Math.log(window.__universeObservatoryState.distance / window.__universeObservatoryState.distanceTarget)) < 1e-8")
    page.wait_for_timeout(220)
    saved = state(page)
    capture(page, "galaxy-before-leaving", output, evidence)
    page.get_by_test_id("restore-guide").click()
    guide_control(page, 'next-observation').press("Enter")
    assert settled(page)["observed"] == "Orion Nebula"
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id(f"revisit-{identity}").press("Enter")
    restored = settled(page)
    capture(page, "galaxy-revisited", output, evidence)
    for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll"):
        assert math.isclose(restored[field], saved[field], rel_tol=1e-7, abs_tol=1e-9), f"{field}: restored {restored[field]}, original {saved[field]}"
    page.goto(configured_url(base, lang="zh", target="NGC-224"), wait_until="networkidle")
    wait_ready(page, errors)
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("star-search").fill("仙女座")
    page.get_by_test_id("destination-andromeda").press("Enter")
    settled(page)
    toggle_reading(page)
    source = page.get_by_test_id("target-details").get_by_role("link")
    source.focus()
    box = source.bounding_box()
    assert box["y"] >= 0 and box["y"] + box["height"] <= 844
    capture(page, "galaxy-narrow-reading", output, evidence)
    toggle_reading(page)
    page.get_by_test_id("hide-guide").click()
    previous_time = state(page)["animationTime"]
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("previous => window.__universeObservatoryState?.animationTime > previous", arg=previous_time)
    timeline(evidence, "galaxy-return-start")
    page.get_by_test_id("return-overview").press("Enter")
    for name, delay in (("galaxy-return-disc", 180), ("galaxy-return-system", 400), ("galaxy-return-map", 650)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    returned = settled(page)
    assert returned["activeId"] == returned["observedId"] == identity and returned["scaleStage"] == "Galactic"
    timeline(evidence, "galaxy-return-complete")
    evidence.update(status="passed", errors=errors, orbitPixelDifference=difference, reducedPixelDifference=frozen_difference,
                    profiles=profiles, aliasesAndBilingual=True, scalesAndAnchor=True, stoppedAndResumed=True,
                    revisitAndMixedTransfer=True, sourceAndExport=True, returnedWithIdentity=True)
    assert not errors, errors
    page.close()


def run_jupiter(browser, url, output, report, Image, ImageChops, ImageStat):
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["jupiterJourney"] = evidence
    options = {"viewport": {"width": 1400, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "jupiter-video"), record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, lang="en", target="Sol", budget=report["qualityProfile"])
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    guide_section(page, 'related')
    entry = page.get_by_test_id("body-relations").locator('button[data-target="Jupiter"]:visible')
    assert entry.is_visible()
    capture(page, "jupiter-solar-entry", output, evidence)
    entry.press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    page.get_by_test_id("stop-flight").press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    stopped = capture(page, "jupiter-stopped-near-sun", output, evidence)
    assert stopped["active"] == "Jupiter" and stopped["observed"] == "Sol"
    page.wait_for_timeout(350)
    for field in ("distance", "cameraYaw", "cameraPitch", "observedId", "activeId"):
        assert state(page)[field] == stopped[field]
    page.get_by_test_id("resume-flight").press("Enter")
    for phase in ("departing", "crossing", "approaching"):
        page.wait_for_function("phase => window.__universeObservatoryState?.flightPhase === phase", arg=phase)
        capture(page, f"jupiter-flight-{phase}", output, evidence)
    arrived = settled(page)
    identity = arrived["activeId"]
    assert arrived["observedId"] == identity and arrived["observedKind"] == "planet"
    assert arrived["relations"]["parent"]["target"] == "Sol"
    capture(page, "jupiter-arrived", output, evidence)
    assert guide_control(page, 'next-observation').get_attribute("data-target") == "Earth"
    page.get_by_test_id("hide-guide").press("Enter")
    page.get_by_test_id("scale-slider").press("End")
    closest = settled(page)
    assert closest["distance"] < arrived["distance"] and closest["scaleStage"] == "Surface"
    for field in ("cameraYaw", "cameraPitch", "cameraRoll"):
        assert math.isclose(closest[field], arrived[field], rel_tol=1e-8, abs_tol=1e-9)
    assert abs(closest["observedX"]-700)<1 and abs(closest["observedY"]-450)<1
    capture(page, "jupiter-closest-clouds", output, evidence)
    first, metrics = surface_sample(page, closest, Image)
    page.wait_for_timeout(900)
    alive, _ = surface_sample(page, state(page), Image)
    idle_difference = ImageStat.Stat(ImageChops.difference(first, alive)).mean
    assert state(page)["animationTime"] > closest["animationTime"] and max(idle_difference)>0.05
    capture(page, "jupiter-cloud-motion", output, evidence)
    scene = page.get_by_test_id("star-map")
    scene.hover()
    page.mouse.move(810, 360)
    page.mouse.down()
    for x in range(830, 1001, 10):
        page.mouse.move(x, 360)
        page.wait_for_timeout(40)
    page.mouse.up()
    scene.press("Escape")
    orbited = settled(page)
    second, _ = surface_sample(page, orbited, Image)
    difference = ImageStat.Stat(ImageChops.difference(first, second)).mean
    assert max(difference)>0.3 and orbited["cameraYaw"] != closest["cameraYaw"]
    capture(page, "jupiter-orbited-storms", output, evidence)
    page.mouse.move(orbited["observedX"],orbited["observedY"])
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId === id",arg=identity)
    page.mouse.move(orbited["observedX"]+orbited["starRadiusPx"]*1.5,orbited["observedY"])
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId !== id",arg=identity)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(300)
    frozen = state(page)
    first, _ = surface_sample(page, frozen, Image)
    page.wait_for_timeout(400)
    second, _ = surface_sample(page, state(page), Image)
    frozen_difference = ImageStat.Stat(ImageChops.difference(first, second)).mean
    assert max(frozen_difference)<0.05 and state(page)["animationTime"] == frozen["animationTime"]
    profiles = []
    for key, width in (("safe",1024),("standard",2048),("immersive",4096)):
        page.get_by_test_id("open-quality").press("Enter")
        radio = page.get_by_test_id(f"quality-{key}")
        if not radio.is_checked():
            radio.check()
        page.wait_for_function("key => window.__universeObservatoryState?.quality?.key === key",arg=key)
        page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
        page.keyboard.press("Escape")
        current = settled(page)
        for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll", "observedId", "activeId", "animationTime"):
            assert current[field] == frozen[field], field
        assert current["quality"]["jupiterTextureWidth"] == width
        assert current["quality"]["width"]*current["quality"]["height"] <= current["quality"]["pixelLimit"]
        profiles.append(current["quality"])
        capture(page, f"jupiter-quality-{key}", output, evidence)
    scene.press("ArrowLeft")
    settled(page)
    assert state(page)["cameraYaw"] != frozen["cameraYaw"]
    save_observation(page,"jupiter-clouds",output,evidence,Image,ImageStat,pause_ms=300)
    page.get_by_test_id("restore-guide").press("Enter")
    toggle_reading(page)
    source = page.get_by_test_id("target-source")
    maps = page.get_by_test_id("target-map-source")
    assert source.get_attribute("href") == "https://science.nasa.gov/jupiter/jupiter-facts/"
    assert maps.get_attribute("href") == "https://www.solarsystemscope.com/textures/"
    source.focus()
    page.keyboard.press("Tab")
    assert maps.evaluate("element => element === document.activeElement")
    capture(page, "jupiter-science-and-map", output, evidence)
    toggle_reading(page)
    saved = settled(page)
    guide_section(page, 'related')
    page.get_by_test_id("body-relations").locator('button[data-target="Sol"]:visible').press("Enter")
    assert settled(page)["observed"] == "Sol"
    page.get_by_test_id("open-destinations").press("Enter")
    page.get_by_test_id("browse-featured").press("Enter")
    page.get_by_test_id(f"revisit-{identity}").press("Enter")
    settled(page)
    page.wait_for_function("""id => {
      const s=window.__universeObservatoryState;
      return s?.activeId===id && s.observedId===id && !s.flight && !s.revisiting && s.navigationState==='observing';
    }""",arg=identity)
    for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll"):
        assert math.isclose(state(page)[field],saved[field],rel_tol=1e-7,abs_tol=1e-9)
    capture(page, "jupiter-revisited", output, evidence)
    guide_control(page, 'next-observation').press("Enter")
    assert settled(page)["observed"] == "Earth"
    capture(page, "jupiter-contrast-earth", output, evidence)
    page.set_viewport_size({"width":390,"height":844})
    page.goto(configured_url(base,lang="zh",target=identity),wait_until="networkidle")
    wait_ready(page,errors)
    page.get_by_test_id("open-destinations").press("Enter")
    page.get_by_test_id("browse-planet").press("Enter")
    assert page.get_by_test_id("destination-jupiter").is_visible()
    search = page.get_by_test_id("star-search")
    for query in ("jUpItEr", "木星"):
        search.fill(query)
        assert page.get_by_test_id("destinations").locator("button[data-target]:visible").count()==1
    search.press("Enter")
    assert settled(page)["observedId"] == identity
    toggle_reading(page)
    for width,height,name in ((390,844,"portrait"),(844,390,"landscape")):
        page.set_viewport_size({"width":width,"height":height})
        page.wait_for_timeout(250)
        page.get_by_test_id("scale-slider").press("End")
        current = settled(page)
        area=current["observationArea"];radius=current["bodyExtentPx"]
        assert current["observedX"]-radius>=area["x"]-1 and current["observedX"]+radius<=area["x"]+area["width"]+1
        assert current["observedY"]-radius>=area["y"]-1 and current["observedY"]+radius<=area["y"]+area["height"]+1
        maps.focus()
        box=maps.bounding_box();card=page.get_by_test_id("target-guide").bounding_box()
        assert card["y"]<=box["y"] and box["y"]+box["height"]<=card["y"]+card["height"]+1
        capture(page,f"jupiter-{name}-reading",output,evidence)
    page.set_viewport_size({"width":1400,"height":900})
    toggle_reading(page)
    held_time = state(page)["animationTime"]
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("previous => window.__universeObservatoryState.animationTime > previous",arg=held_time)
    page.get_by_test_id("return-overview").press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flight")
    for i,delay in enumerate((200,450,650)):
        page.wait_for_timeout(delay)
        capture(page,f"jupiter-return-{i}",output,evidence)
    returned=settled(page)
    assert returned["activeId"]==returned["observedId"]==identity and returned["scaleStage"]=="Galactic"
    evidence.update(status="passed",errors=errors,solarEntryAndReturn=True,bilingualDiscovery=True,
                    closestViewAndOrbit=True,surfaceMetrics=metrics,orbitPixelDifference=difference,
                    profiles=profiles,idlePixelDifference=idle_difference,reducedPixelDifference=frozen_difference,qualityPosePreserved=True,
                    sourceAndExport=True,revisitAndContrast=True,narrowReading=True)
    assert not errors,errors
    page.close()


def run_routes(browser, url, output, report, Image, ImageChops, ImageStat):
    """Plan, observe, stop, detour, continue and finish bounded session routes."""
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["routesJourney"] = evidence
    options = {"viewport": {"width": 1280, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "routes-video"), record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(configured_url(url, debug=1, lang="en", catalog=50000, budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    pose_fields = ("activeId", "observedId", "distance", "distanceTarget", "cameraYaw", "cameraPitch", "cameraRoll")
    panel = page.get_by_test_id("destinations")
    plan = page.get_by_test_id("route-plan")
    guide = page.get_by_test_id("route-guide")

    def steady(identity=None):
        page.wait_for_timeout(300)
        page.wait_for_function("""id => {
          const s = window.__universeObservatoryState;
          return s && !s.flight && s.navigationState === 'observing' && s.distance === s.distanceTarget &&
            (id === null || (s.activeId === id && s.observedId === id));
        }""", arg=identity, timeout=30000)
        page.wait_for_timeout(300)
        return state(page)

    def progress(count):
        page.wait_for_function("n => document.querySelector('[data-testid=route-progress]')?.dataset.observedCount === String(n)", arg=count)

    def routes():
        if not panel.is_visible():
            page.get_by_test_id("open-destinations").press("Enter")
        if not page.get_by_test_id("exploration-routes").is_visible():
            page.get_by_test_id("navigation-routes").press("Enter")

    initial = steady(0)
    routes()
    assert page.get_by_test_id("route-list").get_by_role("button").count() == 2
    page.get_by_test_id("route-sunlight").press("Enter")
    progress(0)
    assert page.get_by_test_id("route-stops").get_by_role("button").count() == 4
    assert page.get_by_test_id("route-source").get_attribute("href").startswith("https://science.nasa.gov/")
    after_plan = steady(0)
    assert all(after_plan[key] == initial[key] for key in pose_fields), "Planning changed observation"
    capture(page, "routes-plan-before-departure", output, evidence)
    page.get_by_test_id("route-next").press("Enter")
    assert not panel.is_visible()
    steady(0)
    progress(1)
    capture(page, "routes-sun-arrived", output, evidence)
    hold = state(page)
    page.wait_for_timeout(900)
    assert all(state(page)[key] == hold[key] for key in pose_fields), "Route advanced without explicit input"
    guide.press("Enter")
    assert plan.is_visible() and plan.get_attribute("data-active") == "true"
    guide_name = guide.get_attribute("aria-expanded")
    assert guide_name == "true"
    page.get_by_test_id("route-next").press("Escape")
    assert not panel.is_visible() and guide.evaluate("el => el === document.activeElement")

    guide_control(page, 'next-observation').press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flight")
    page.wait_for_timeout(120)
    leaving = capture(page, "routes-earth-departure", output, evidence)
    assert leaving["activeId"] == 50000 and leaving["observedId"] == 0
    progress(1)
    page.get_by_test_id("stop-flight").press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    progress(1)
    capture(page, "routes-stopped-before-arrival", output, evidence)
    guide.press("Enter")
    page.get_by_test_id("route-next").press("Enter")
    steady(50000)
    progress(2)
    capture(page, "routes-earth-arrived", output, evidence)

    page.get_by_test_id("open-destinations").press("Enter")
    page.get_by_test_id("browse-featured").press("Enter")
    page.get_by_test_id("star-search").fill("Mars")
    page.get_by_test_id("star-search").press("Enter")
    steady(50004)
    progress(2)
    capture(page, "routes-free-detour", output, evidence)
    assert guide_control(page, 'next-observation').get_attribute("data-target") == "Earth"
    guide.press("Enter")
    page.get_by_test_id("route-next").press("Enter")
    steady(50003)
    progress(3)
    capture(page, "routes-moon-after-detour", output, evidence)
    moon_pose = state(page)
    page.get_by_test_id("open-quality").press("Enter")
    page.get_by_test_id("quality-immersive").check()
    page.wait_for_function("window.__universeObservatoryState.quality.key === 'immersive'")
    page.get_by_test_id("close-quality").press("Enter")
    changed_quality = steady(50003)
    assert all(changed_quality[key] == moon_pose[key] for key in pose_fields)
    progress(3)
    capture(page, "routes-quality-preserves-progress", output, evidence)
    guide_control(page, 'next-observation').press("Enter")
    steady(50006)
    progress(4)
    capture(page, "routes-sunlight-completed", output, evidence)
    guide_control(page, 'next-observation').press("Enter")
    assert plan.is_visible() and plan.get_attribute("data-complete") == "true"
    assert page.get_by_test_id("route-stops").locator('button[data-visited="true"]').count() == 4
    page.get_by_test_id("route-stop-earth").press("Enter")
    steady(50000)
    progress(4)
    capture(page, "routes-completed-stop-revisited", output, evidence)
    guide.press("Enter")
    page.get_by_test_id("route-stop-halley").press("Enter")
    steady(50006)
    progress(4)
    guide.press("Enter")
    completed = steady(50006)
    page.get_by_test_id("route-list-back").press("Enter")
    page.get_by_test_id("route-stellar-stories").press("Enter")
    planned = steady(50006)
    assert all(planned[key] == completed[key] for key in pose_fields)
    assert page.get_by_test_id("route-stops").get_by_role("button").count() == 3
    progress(0)
    capture(page, "routes-stellar-plan", output, evidence)
    page.get_by_test_id("route-next").press("Enter")
    steady(50002)
    progress(1)
    capture(page, "routes-cloud-arrived", output, evidence)
    guide_control(page, 'next-observation').press("Enter")
    steady(18)
    progress(2)
    capture(page, "routes-giant-arrived", output, evidence)
    guide_control(page, 'next-observation').press("Enter")
    steady(50008)
    progress(3)
    capture(page, "routes-remnant-completed", output, evidence)
    save_observation(page, "routes-remnant", output, evidence, Image, ImageStat, pause_ms=500)
    guide.press("Enter")
    before_exit = steady(50008)
    page.get_by_test_id("route-leave").press("Enter")
    assert not guide.is_visible() and plan.get_attribute("data-active") == "false"
    assert guide_control(page, 'next-observation').get_attribute("data-target") == "Sol"
    after_exit = steady(50008)
    assert all(after_exit[key] == before_exit[key] for key in pose_fields)
    page.get_by_test_id("route-next").press("Escape")
    assert page.get_by_test_id("open-destinations").evaluate("el => el === document.activeElement")
    capture(page, "routes-left-with-view-preserved", output, evidence)
    page.get_by_test_id("return-overview").press("Enter")
    assert steady(50008)["scaleStage"] == "Galactic"
    capture(page, "routes-returned-map", output, evidence)

    page.emulate_media(reduced_motion="reduce")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(configured_url(url, debug=1, lang="zh", catalog=50000, budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    routes()
    page.get_by_test_id("route-sunlight").press("Enter")
    progress(0)
    for width, height, name in ((390, 844, "portrait"), (844, 390, "short-landscape"), (320, 640, "compact")):
        page.set_viewport_size({"width": width, "height": height})
        page.get_by_test_id("route-next").focus()
        page.wait_for_timeout(250)
        box = page.get_by_test_id("route-next").bounding_box()
        assert box and 0 <= box["x"] and box["x"] + box["width"] <= width + 1
        assert 0 <= box["y"] and box["y"] + box["height"] <= height + 1
        assert page.get_by_test_id("route-next").evaluate("""element => {
          const r = element.getBoundingClientRect();
          return [r.top + 3, r.top + r.height / 2, r.bottom - 3].every(y =>
            element.contains(document.elementFromPoint(r.left + r.width / 2, y)));
        }"""), "The focused departure action must be visible and unobscured."
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        capture(page, f"routes-{name}-plan", output, evidence)
    page.get_by_test_id("route-next").press("Enter")
    reduced_arrival = steady(0)
    assert reduced_arrival["animationTime"] == 0 and not reduced_arrival["flight"]
    progress(1)
    localized_prompt = page.evaluate("""async () => {
      const routes = await import('/assets/observatory-routes.js');
      return routes.nextRouteStop({ key: 'sunlight', visited: ['Sol'] }, document.documentElement.lang).prompt;
    }""")
    assert localized_prompt in guide_control(page, 'next-observation').inner_text()
    guide.press("Enter")
    page.get_by_test_id("route-stop-moon").press("Enter")
    steady(50003)
    progress(2)
    guide.press("Enter")
    assert page.get_by_test_id("route-stop-sol").get_attribute("data-visited") == "true"
    assert page.get_by_test_id("route-stop-moon").get_attribute("data-visited") == "true"
    page.get_by_test_id("route-next").press("Enter")
    steady(50000)
    progress(3)
    capture(page, "routes-reduced-out-of-order", output, evidence)
    evidence.update(status="passed", errors=errors, plansPreservePose=True, explicitDepartures=True,
                    actualObservationProgress=True, stoppedIntentNotCounted=True, detourAndContinue=True,
                    completedAndRevisitedStops=True, qualityPreservesProgress=True, localPngExport=True, bilingualAndSmallScreen=True,
                    reducedMotionAndOutOfOrder=True, routeExitAndMapReturn=True)
    assert not errors, errors
    page.close()


def run_small_worlds(browser, url, output, report, Image, ImageChops, ImageStat):
    """Discover both main-belt worlds, inspect their close views and return."""
    errors=[]
    evidence={"status":"running","cases":[],"errors":errors}
    report["smallWorldsJourney"]=evidence
    options={"viewport":{"width":1280,"height":720},"device_scale_factor":1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output/"smallworld-video"),record_video_size=options["viewport"])
    context=browser.new_context(**options)
    page=context.new_page()
    page.on("pageerror",lambda e: errors.append(str(e)))
    page.on("console",lambda m: errors.append(m.text) if m.type=="error" else None)
    def steady(identity):
        settled(page)
        page.wait_for_function("""id=>{const s=window.__universeObservatoryState;
          return s&&s.activeId===id&&s.observedId===id&&!s.flight&&s.distance===s.distanceTarget;}""",arg=identity,timeout=30000)
        previous=state(page)
        for _ in range(20):
            page.wait_for_timeout(200)
            current=state(page)
            if all(current[k]==previous[k] for k in ("distance","cameraYaw","cameraPitch","cameraRoll","fov")):
                return current
            previous=current
        raise AssertionError("The small-world pose and reading projection did not settle")
    def mode(value):
        page.get_by_test_id("open-dynamics").click();page.get_by_test_id("motion-"+value).check()
        page.keyboard.press("Escape")
        page.wait_for_function("v=>window.__universeObservatoryState?.sceneMotion?.mode===v",arg=value)
    try:
        for language,target,identity,category,query,other,other_id in [
            ("en","Ceres",50024,"dwarfplanet","Ceres","Vesta",50025),
            ("zh","Vesta",50025,"asteroid","灶神星","Ceres",50024)]:
            case={"language":language,"target":target,"status":"running","captures":[],"events":[],"timelineOrigin":time.monotonic()}
            if page.video:case["video"]=str(page.video.path())
            evidence["cases"].append(case)
            page.set_viewport_size(options["viewport"]);page.emulate_media(reduced_motion="no-preference")
            page.goto(configured_url(url,debug=1,lang=language,target="Sol",catalog=50000,budget=report["qualityProfile"]),wait_until="networkidle")
            wait_ready(page,errors);mode("paused")
            page.get_by_test_id("open-destinations").press("Enter")
            page.get_by_test_id("browse-"+category).press("Enter")
            page.get_by_test_id("star-search").fill(query)
            assert page.get_by_test_id("browse-"+category).get_attribute("aria-pressed")=="true"
            capture(page,language+"-discovery",output,case)
            page.get_by_test_id("destination-"+target.lower()).press("Enter")
            whole=steady(identity)
            assert whole["activeKind"]==category and whole["planetDraw"]==8
            assert isinstance(whole["quality"]["satelliteTextureLayers"], int) and whole["quality"]["satelliteTextureLayers"] > 0
            capture(page,language+"-whole",output,case)
            page.get_by_test_id("hide-guide").click();full_observation(page)
            fixed=state(page);mode("flow");page.wait_for_timeout(1300)
            active=capture(page,language+"-flowing",output,case)
            assert active["animationTime"]>fixed["animationTime"]
            for k in ("distance","cameraYaw","cameraPitch","cameraRoll","fov"):
                assert active[k]==fixed[k]
            mode("paused")
            page.get_by_test_id("scale-slider").press("End")
            close=steady(identity)
            assert close["distance"]<whole["distance"] and close["fov"]==fixed["fov"]
            capture(page,language+"-close",output,case)
            scene=page.get_by_test_id("star-map")
            page.mouse.move(close["observedX"],close["observedY"])
            page.wait_for_function("id=>window.__universeObservatoryState?.hoveredId===id",arg=identity)
            page.mouse.move(close["observedX"]+close["bodyExtentPx"]*1.5,close["observedY"])
            page.wait_for_function("id=>window.__universeObservatoryState?.hoveredId!==id",arg=identity)
            for _ in range(7):scene.press("ArrowRight");page.wait_for_timeout(40)
            orbit=steady(identity);assert orbit["distance"]==close["distance"]
            capture(page,language+"-orbit",output,case)
            if language=="en":
                held=state(page)
                for quality in ["safe" if report["qualityProfile"]!="safe" else "immersive",report["qualityProfile"]]:
                    page.get_by_test_id("open-quality").click();page.get_by_test_id("quality-"+quality).check()
                    page.wait_for_function("q=>window.__universeObservatoryState?.quality?.key===q",arg=quality)
                    page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
                    page.keyboard.press("Escape");current=steady(identity)
                    assert current["quality"]["satelliteTextureLayers"] == whole["quality"]["satelliteTextureLayers"]
                    for k in ("activeId","observedId","distance","cameraYaw","cameraPitch","cameraRoll","animationTime","fov"):
                        assert current[k]==held[k], {"field":k,"before":held[k],"after":current[k]}
            page.get_by_test_id("restore-guide").click();steady(identity)
            toggle_reading(page)
            assert page.get_by_test_id("target-source").get_attribute("href").startswith("https://science.nasa.gov/")
            assert page.get_by_test_id("target-map-source").get_attribute("href")=="https://dawngis.dlr.de/data/"+target+"/mosaic_"+target.lower()+".php"
            capture(page,language+"-source",output,case)
            toggle_reading(page)
            save_observation(page,report["qualityProfile"]+"-"+language+"-"+target.lower(),output,case,Image,ImageStat,pause_ms=250)
            guide_control(page, 'next-observation').press("Enter")
            steady(other_id);capture(page,language+"-comparison",output,case)
            page.get_by_test_id("scale-slider").press("End");steady(other_id)
            capture(page,language+"-comparison-close",output,case)
            if language=="zh":
                page.emulate_media(reduced_motion="reduce");page.set_viewport_size({"width":390,"height":844})
                steady(other_id);assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
                capture(page,language+"-narrow",output,case)
            page.get_by_test_id("open-destinations").press("Enter")
            page.get_by_test_id("navigation-system").press("Enter")
            page.get_by_test_id("system-overview").press("Enter")
            root=steady(0);assert root["systemView"]["scope"]=="family"
            assert {50024,50025}<=set(root["systemView"]["memberIds"])
            capture(page,language+"-solar-return",output,case)
            page.emulate_media(reduced_motion="reduce");page.get_by_test_id("return-overview").press("Enter")
            page.wait_for_function("window.__universeObservatoryState?.scaleStage==='Galactic'&&!window.__universeObservatoryState.flight")
            assert page.get_by_test_id("return-overview").is_disabled()
            capture(page,language+"-global-return",output,case);case["status"]="passed"
    finally:context.close()
    assert not errors,errors
    evidence.update(status="passed",bilingualClassification=True,wholeCloseAndOrbit=True,solidPicking=True,
                    fixedLensWithActivity=True,qualityRoundTrip=True,actualAttributedPng=True,solarAndGlobalReturns=True)


def run_inner_worlds(browser, url, output, report, Image, ImageChops, ImageStat):
    """Unfold the crowded inner family, visit a world and return using public UI."""
    errors = []
    evidence = {"status": "running", "cases": [], "errors": errors}
    report["innerWorldsJourney"] = evidence
    expected = {0, 50000, 50003, 50004, 50010, 50011, 50031, 50032}
    pose_keys = ("activeId", "observedId", "distance", "distanceTarget", "cameraYaw", "cameraPitch", "cameraRoll", "fov")
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "inner-video"), record_video_size=options["viewport"])
    context = browser.new_context(**options)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

    def steady(identity=0, scope=None):
        page.wait_for_function("""([id,scope]) => {
          const s = window.__universeObservatoryState;
          return s && s.activeId === id && s.observedId === id && !s.flight && s.navigationState === 'observing' &&
            s.distance === s.distanceTarget && (!scope || (s.systemView?.scope === scope && s.systemView.visible));
        }""", arg=[identity, scope], timeout=30000)
        previous = state(page)
        for _ in range(20):
            page.wait_for_timeout(200)
            current = state(page)
            if current["fov"] == previous["fov"] and all(math.isclose(current[k], previous[k], abs_tol=1e-4, rel_tol=0) for k in ("observedX", "observedY")):
                return current
            previous = current
        raise AssertionError("Inner-world reading projection did not settle")

    def motion(mode):
        page.get_by_test_id("open-dynamics").click()
        page.get_by_test_id("motion-" + mode).check()
        page.keyboard.press("Escape")
        page.wait_for_function("m => window.__universeObservatoryState?.sceneMotion?.mode === m", arg=mode)

    try:
        for language, target, identity in [("en", "Mercury", 50010), ("zh", "Venus", 50011)]:
            case = {"language": language, "captures": [], "events": [], "timelineOrigin": time.monotonic(), "status": "running"}
            if page.video:
                case["video"] = str(page.video.path())
            evidence["cases"].append(case)
            page.emulate_media(reduced_motion="no-preference")
            page.set_viewport_size(options["viewport"])
            page.goto(configured_url(url, debug=1, lang=language, target="Sol", catalog=50000,
                                     budget=report["qualityProfile"]), wait_until="networkidle")
            wait_ready(page, errors)
            motion("paused")
            page.get_by_test_id("open-destinations").press("Enter")
            page.get_by_test_id("navigation-system").press("Enter")
            panel = page.get_by_test_id("solar-navigation")
            assert panel.get_by_test_id("inner-system-overview").is_enabled()
            page.get_by_test_id("system-overview").press("Enter")
            full = steady(scope="family")
            capture(page, language + "-full-family", output, case)
            guide_control(page, 'guide-inner-system').press("Enter")
            inner = steady(scope="inner")
            assert set(inner["systemView"]["memberIds"]) == expected
            assert inner["activeId"] == full["activeId"] == inner["systemView"]["rootId"] == 0
            assert inner["distance"] < full["distance"] and inner["fov"] == full["fov"]
            assert guide_control(page, 'guide-solar-overview').is_visible()
            capture(page, language + "-inner-arrived", output, case)
            held = state(page)
            motion("flow")
            page.wait_for_timeout(900)
            flowing = state(page)
            assert flowing["animationTime"] > held["animationTime"]
            assert all(flowing[k] == held[k] for k in pose_keys)
            capture(page, language + "-inner-flowing", output, case)
            motion("paused")
            guide_section(page, 'related')
            page.get_by_test_id("body-relations").locator('button[data-target="' + target + '"]:visible').press("Enter")
            if language == "en":
                page.wait_for_function("window.__universeObservatoryState?.flight")
                page.get_by_test_id("stop-flight").press("Enter")
                page.wait_for_function("!window.__universeObservatoryState?.flight")
                stopped = capture(page, language + "-stopped", output, case)
                page.wait_for_timeout(350)
                assert all(state(page)[k] == stopped[k] for k in pose_keys)
                assert stopped["navigationState"] == "paused"
                page.get_by_test_id("resume-flight").press("Enter")
            whole = steady(identity)
            capture(page, language + "-world-arrived", output, case)
            page.get_by_test_id("scale-slider").press("End")
            close = steady(identity)
            assert close["distance"] < whole["distance"] and close["fov"] == whole["fov"]
            capture(page, language + "-world-close", output, case)
            guide_control(page, 'guide-inner-system').press("Enter")
            returned = steady(scope="inner")
            assert set(returned["systemView"]["memberIds"]) == expected
            capture(page, language + "-inner-returned", output, case)
            if language == "zh":
                page.set_viewport_size({"width": 390, "height": 844})
                page.get_by_test_id("open-destinations").press("Enter")
                page.get_by_test_id("navigation-system").press("Enter")
                page.emulate_media(reduced_motion="reduce")
                page.get_by_test_id("inner-system-overview").press("Enter")
                narrow = steady(scope="inner")
                assert narrow["sceneMotion"]["rate"] == 0
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                capture(page, language + "-inner-narrow", output, case)
            save_observation(page, report["qualityProfile"] + "-" + language + "-inner", output, case, Image, ImageStat, pause_ms=250)
            guide_control(page, 'guide-solar-overview').press("Enter")
            wider = steady(scope="family")
            assert set(wider["systemView"]["memberIds"]) > expected
            capture(page, language + "-full-returned", output, case)
            page.emulate_media(reduced_motion="reduce")
            page.get_by_test_id("return-overview").press("Enter")
            page.wait_for_function("window.__universeObservatoryState?.scaleStage === 'Galactic' && !window.__universeObservatoryState.flight")
            assert state(page)["activeId"] == 0 and page.get_by_test_id("return-overview").is_disabled()
            capture(page, language + "-global-return", output, case)
            case["status"] = "passed"
    finally:
        context.close()
    assert not errors, errors
    evidence.update(status="passed", sameCatalogAndRoot=True, boundedSubset=True, normalAndReducedMotion=True,
                    heldDirectionWithActivity=True, interruptionAndResume=True, fixedLensNearAndReturn=True,
                    bilingualKeyboardAndNarrow=True, actualLocalPng=True, fullAndGlobalReturn=True)


def run_systems(browser, url, output, report, Image, ImageChops, ImageStat):
    """Discover a bounded family, visit its members and return through one camera."""
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["systemsJourney"] = evidence
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "systems-video"), record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(configured_url(url, debug=1, lang="zh", target="Sol", catalog=50000,
                             budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    scene = page.locator("#scene")
    panel = page.get_by_test_id("destinations")
    family_panel = page.get_by_test_id("solar-navigation")
    pose_fields = ("distance", "distanceTarget", "cameraYaw", "cameraPitch", "cameraRoll", "activeId", "observedId")
    member_ids = {0, 50000, 50001, 50003, 50004, 50006, 50007, 50010, 50011, 50012, 50013}

    def steady(identity=None):
        page.wait_for_timeout(300)
        page.wait_for_function("""id => {
          const s = window.__universeObservatoryState;
          return s && !s.flight && s.navigationState === 'observing' && s.distance === s.distanceTarget &&
            (id === null || (s.activeId === id && s.observedId === id));
        }""", arg=identity, timeout=20000)
        page.wait_for_timeout(400)
        return state(page)

    def family():
        if not panel.is_visible():
            page.get_by_test_id("open-destinations").press("Enter")
        if not family_panel.is_visible():
            page.get_by_test_id("navigation-system").press("Enter")
        assert family_panel.is_visible()
        assert page.get_by_test_id("system-overview").evaluate("el => el === document.activeElement")

    def overview(name):
        family()
        page.get_by_test_id("system-overview").press("Enter")
        current = steady(0)
        assert not panel.is_visible()
        assert current["systemView"]["rootId"] == 0 and current["systemView"]["visible"]
        assert set(current["systemView"]["memberIds"]) == member_ids
        area = current["observationArea"]
        for target in current["visibleTargets"]:
            if target["id"] in member_ids:
                assert area["x"] <= target["x"] <= area["x"] + area["width"]
                assert area["y"] <= target["y"] <= area["y"] + area["height"]
        assert member_ids.issubset({target["id"] for target in current["visibleTargets"]})
        capture(page, name, output, evidence)
        return current

    def keyboard_member(identity):
        for _ in range(2 * len(member_ids)):
            page.keyboard.press("ArrowDown")
            if page.get_by_test_id(f"system-member-{identity}").evaluate("el => el === document.activeElement"):
                return
        raise AssertionError(f"Solar member {identity} is not keyboard reachable")

    start = steady(0)
    assert guide_control(page, 'guide-local-system').is_visible()
    family()
    assert family_panel.locator("button[data-member-id]").count() == len(member_ids)
    capture(page, "systems-family-navigation", output, evidence)
    page.get_by_test_id("navigation-dynamics").press("Enter")
    assert page.get_by_test_id("motion-flow").is_visible()
    page.get_by_test_id("navigation-system").press("Enter")
    page.keyboard.press("Escape")
    assert not panel.is_visible()
    assert page.get_by_test_id("open-destinations").evaluate("el => el === document.activeElement")
    for field in pose_fields:
        assert state(page)[field] == start[field], f"Navigation browsing moved {field}"

    family()
    page.get_by_test_id("system-overview").press("Enter")
    page.wait_for_timeout(700)
    capture(page, "systems-first-flight", output, evidence)
    scene.press("Escape")
    page.wait_for_function("() => window.__universeObservatoryState?.navigationState === 'paused'")
    stopped = capture(page, "systems-first-stopped", output, evidence)
    page.wait_for_timeout(600)
    for field in pose_fields:
        assert state(page)[field] == stopped[field], f"Stopped system flight drifted {field}"
    assert page.get_by_test_id("resume-flight").is_visible()
    page.get_by_test_id("resume-flight").press("Enter")
    first = steady(0)
    assert first["systemView"]["visible"]
    capture(page, "systems-first-arrival", output, evidence)
    guide_control(page, 'guide-system-members').press("Enter")
    assert family_panel.is_visible()
    page.keyboard.press("Escape")
    assert guide_control(page, 'guide-system-members').evaluate("el => el === document.activeElement")
    for field in pose_fields:
        assert state(page)[field] == first[field], f"Family guide entry moved {field}"
    page.wait_for_timeout(1200)
    save_observation(page, "solar-system", output, evidence, Image, ImageStat)
    assert state(page)["systemView"]["visible"]
    assert not state(page)["systemView"]["pending"]

    # A projected member has the same canonical identity as its list entry.
    current = steady(0)
    for identity in sorted(member_ids - {50003}):
        current = state(page)
        target = next(body for body in current["visibleTargets"] if body["id"] == identity)
        page.mouse.move(target["x"], target["y"])
        page.wait_for_function("id => window.__universeObservatoryState?.hoveredId === id", arg=identity)
    capture(page, "systems-member-markers-preserve-identity", output, evidence)
    current = state(page)
    jupiter = next(body for body in current["visibleTargets"] if body["id"] == 50007)
    scene.click(position={"x": jupiter["x"], "y": jupiter["y"]})
    page.wait_for_timeout(600)
    capture(page, "systems-picked-jupiter-flight", output, evidence)
    arrived = steady(50007)
    assert arrived["systemView"] is None
    capture(page, "systems-picked-jupiter-arrival", output, evidence)
    page.wait_for_timeout(1500)
    family()
    page.get_by_test_id("system-overview").press("Enter")
    page.wait_for_timeout(650)
    departing = capture(page, "systems-leaving-jupiter", output, evidence)
    assert departing["activeId"] == 0 and departing["observedId"] == 50007
    scene.press("Escape")
    page.wait_for_function("() => window.__universeObservatoryState?.navigationState === 'paused'")
    capture(page, "systems-return-stopped", output, evidence)
    page.get_by_test_id("resume-flight").press("Enter")
    page.wait_for_function("() => { const s=window.__universeObservatoryState; return s?.systemView?.pending && s.flightPhase === 'crossing'; }")
    page.get_by_test_id("capture-view").click()
    page.get_by_test_id("capture-preview").wait_for(state="visible")
    assert page.get_by_test_id("observation-image").get_attribute("data-system-root-id") == ""
    capture(page, "systems-return-flight-preview", output, evidence)
    page.keyboard.press("Escape")
    page.get_by_test_id("capture-preview").wait_for(state="hidden")
    assert steady(0)["systemView"]["visible"]
    capture(page, "systems-jupiter-returned", output, evidence)

    # Nested satellite entry remains keyboard reachable; its parent is unchanged.
    family()
    keyboard_member(50003)
    assert page.get_by_test_id("system-member-50003").evaluate("el => el === document.activeElement")
    capture(page, "systems-moon-keyboard-entry", output, evidence)
    page.keyboard.press("Enter")
    moon = steady(50003)
    assert moon["relations"]["parent"]["id"] == 50000
    capture(page, "systems-moon-arrival", output, evidence)
    page.wait_for_timeout(1000)
    overview("systems-moon-returned")
    page.get_by_test_id("hide-guide").press("Enter")
    full_observation(page)
    overview("systems-free-view")

    moving_start = steady(0)
    capture(page, "systems-moving-family-start", output, evidence)
    for part in range(3):
        page.wait_for_timeout(2400 if report["recordVideo"] else 700)
        moving_end = capture(page, f"systems-moving-family-part-{part+1}", output, evidence)
        for field in (*pose_fields, "fov", "observedX", "observedY"):
            if field in ("observedX", "observedY"):
                assert math.isclose(moving_end[field], moving_start[field], rel_tol=0, abs_tol=1e-5), f"Family centre drifted: {field}"
            else:
                assert moving_end[field] == moving_start[field], f"Family activity moved the camera: {field}"
    before_members = {t["id"]:(t["x"],t["y"]) for t in moving_start["visibleTargets"]}
    after_members = {t["id"]:(t["x"],t["y"]) for t in moving_end["visibleTargets"]}
    for identity in member_ids-{0}:
        assert after_members[identity] != before_members[identity], f"Solar member stayed fixed: {identity}"
    evidence["orbitalReview"] = {"before":before_members,"after":after_members,
        "meaning":"The same fixed camera reveals member displacement; continuous images establish appearance, not an ephemeris."}

    # Quality, layout and activity controls must preserve the world pose.
    for quality in ("standard", "immersive", "safe"):
        previous = steady(0)
        page.get_by_test_id("open-quality").click()
        page.get_by_test_id(f"quality-{quality}").check()
        page.wait_for_function("key => window.__universeObservatoryState?.budget?.key === key", arg=quality)
        page.get_by_test_id("close-quality").press("Enter")
        page.wait_for_timeout(300)
        for field in pose_fields:
            assert state(page)[field] == previous[field], f"Quality moved system view {field}"
        capture(page, f"systems-quality-{quality}", output, evidence)
    current = steady(0)
    scene.press("+")
    zoomed = steady(0)
    assert zoomed["distance"] < current["distance"]
    for field in ("cameraYaw", "cameraPitch", "cameraRoll", "fov"):
        assert zoomed[field] == current[field], f"System zoom changed {field}"
    for axis in ("observedX", "observedY"):
        assert math.isclose(zoomed[axis], current[axis], rel_tol=0, abs_tol=1e-7), f"System centre moved {axis}: {current[axis]} -> {zoomed[axis]}"
    capture(page, "systems-zoom-preserves-centre", output, evidence)
    page.get_by_test_id("scale-Surface").click()
    central_star = steady(0)
    assert not central_star["systemView"]["visible"]
    for field in ("cameraYaw", "cameraPitch", "cameraRoll", "fov"):
        assert central_star[field] == current[field], f"Approaching the central star changed {field}"
    capture(page, "systems-central-star-fixed-lens", output, evidence)
    overview("systems-refit")
    for mode in ("paused", "accelerated"):
        page.get_by_test_id("open-dynamics").click()
        page.get_by_test_id(f"motion-{mode}").check()
        page.wait_for_function("mode => window.__universeObservatoryState?.sceneMotion?.mode === mode", arg=mode)
        page.keyboard.press("Escape")
        overview(f"systems-motion-{mode}")
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("() => window.__universeObservatoryState?.sceneMotion?.rate === 0")
    family()
    page.get_by_test_id("system-member-50006").press("Enter")
    comet = steady(50006)
    assert not comet["flight"] and comet["sceneMotion"]["rate"] == 0
    capture(page, "systems-reduced-comet", output, evidence)
    overview("systems-reduced-return")
    page.get_by_test_id("restore-guide").click()
    page.wait_for_timeout(600)
    for width, height, label in [(390, 844, "portrait"), (844, 390, "landscape"), (320, 640, "small")]:
        previous = steady(0)
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(900)
        for field in pose_fields:
            assert state(page)[field] == previous[field], f"Resize moved {field}"
        family()
        capture(page, f"systems-{label}-navigation", output, evidence)
        button_box = page.get_by_test_id("system-overview").bounding_box()
        panel_box = panel.bounding_box()
        assert button_box and panel_box and button_box["y"] + button_box["height"] <= panel_box["y"] + panel_box["height"]
        keyboard_member(50003)
        assert page.get_by_test_id("system-member-50003").evaluate("el => el === document.activeElement")
        page.get_by_test_id("system-overview").focus()
        overview(f"systems-{label}-overview")
        current = steady(0)
        for identity in sorted(member_ids - {50003}):
            current = state(page)
            target = next(body for body in current["visibleTargets"] if body["id"] == identity)
            page.mouse.move(target["x"], target["y"])
            page.wait_for_function("id => window.__universeObservatoryState?.hoveredId === id", arg=identity)
    page.set_viewport_size({"width": 1280, "height": 720})
    page.goto(configured_url(url, debug=1, lang="en", target="Mars", budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    english = overview("systems-english-overview")
    family()
    page.get_by_test_id("navigation-browse").press("Enter")
    assert page.get_by_test_id("star-search").is_visible()
    page.get_by_test_id("star-search").fill("Earth")
    page.get_by_test_id("star-search").press("Enter")
    assert steady(50000)["systemView"] is None
    capture(page, "systems-english-earth", output, evidence)
    page.get_by_test_id("return-overview").click()
    mapped = steady(50000)
    assert mapped["scaleStage"] == "Galactic" and mapped["systemView"] is None
    capture(page, "systems-normal-map-preserves-earth", output, evidence)
    scene.press("Home")
    assert steady(50004)["scaleStage"] == "Galactic"
    capture(page, "systems-home-restores-configured-mars", output, evidence)

    # A local family preserves the same identities while making a nested orbit readable.
    page.emulate_media(reduced_motion="no-preference")
    page.goto(configured_url(url, debug=1, lang="zh", target="Sol", budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    guide_control(page, 'guide-local-system').wait_for(state="visible")
    guide_control(page, 'guide-local-system').press("Enter")
    local = steady(50000)
    assert local["systemView"]["scope"] == "local" and local["systemView"]["rootId"] == 50000
    assert set(local["systemView"]["memberIds"]) == {50000, 50003}
    assert local["systemView"]["visible"] and not local["systemView"]["pending"]
    assert not local["recentViews"], "Shared space must not record a member close observation"
    assert page.get_by_test_id("target-guide").get_attribute("data-view") == "system"
    assert not page.get_by_test_id("target-details").is_visible()
    guide_section(page, 'related')
    assert page.get_by_test_id("body-relations").get_by_test_id("related-body").count() == 2
    capture(page, "systems-local-shared-arrival", output, evidence)
    initial_moon = next(t for t in local["visibleTargets"] if t["id"] == 50003)
    page.wait_for_timeout(2400)
    moved = capture(page, "systems-local-companion-moving", output, evidence)
    for field in (*pose_fields, "fov", "observedX", "observedY"):
        assert math.isclose(moved[field], local[field], abs_tol=1e-7), f"Local orbit moved camera {field}"
    moved_moon = next(t for t in moved["visibleTargets"] if t["id"] == 50003)
    assert math.hypot(moved_moon["x"] - initial_moon["x"], moved_moon["y"] - initial_moon["y"]) > 1
    evidence["localOrbitalReview"] = {"before": initial_moon, "after": moved_moon, "rootId": 50000,
        "meaning": "A held camera reveals companion displacement in shared space; positions and time are artistic."}
    page.get_by_test_id("open-dynamics").click()
    page.get_by_test_id("motion-paused").check()
    page.keyboard.press("Escape")
    page.wait_for_function("() => window.__universeObservatoryState?.sceneMotion?.rate === 0")
    held = steady(50000)
    paused_overlays = scene_overlay_bounds(page)
    before_pause = capture(page, "systems-local-paused", output, evidence)
    page.wait_for_timeout(600)
    after_pause = capture(page, "systems-local-paused-held", output, evidence)
    assert before_pause["animationTime"] == after_pause["animationTime"]
    first_raster = Image.open(output / "systems-local-paused.png").convert("RGB")
    second_raster = Image.open(output / "systems-local-paused-held.png").convert("RGB")
    paused_difference = scene_pixel_difference(page, first_raster, second_raster, (0, 0, first_raster.width, first_raster.height),
                                               ImageChops, ImageStat, paused_overlays)
    assert max(paused_difference) < .05
    evidence["localPausedPixelDifference"] = paused_difference
    # Pick the moving companion's actual canvas projection while paused.
    moon_target = next(t for t in held["visibleTargets"] if t["id"] == 50003)
    scene.click(position={"x": moon_target["x"], "y": moon_target["y"]})
    assert steady(50003)["systemView"] is None
    capture(page, "systems-local-picked-moon", output, evidence)
    assert guide_control(page, 'guide-local-system').is_visible()
    guide_control(page, 'guide-local-system').press("Enter")
    page.wait_for_timeout(650)
    scene.press("Escape")
    page.wait_for_function("() => window.__universeObservatoryState?.navigationState === 'paused'")
    capture(page, "systems-local-return-stopped", output, evidence)
    page.get_by_test_id("resume-flight").press("Enter")
    assert steady(50000)["systemView"]["scope"] == "local"
    capture(page, "systems-local-moon-returned", output, evidence)
    save_observation(page, "earth-system", output, evidence, Image, ImageStat)
    assert page.get_by_test_id("observation-image").get_attribute("data-system-root-id") == "50000"
    for target, identity in [("Earth", 50000), ("Moon", 50003)]:
        guide_section(page, 'related')
        page.get_by_test_id("body-relations").locator(f'button[data-target="{target}"]').press("Enter")
        near_member = steady(identity)
        assert near_member["systemView"] is None
        recorded = near_member["recentViews"]
        assert identity in {view["id"] for view in recorded}
        capture(page, f"systems-local-approached-{target.lower()}", output, evidence)
        guide_control(page, 'guide-local-system').press("Enter")
        shared_again = steady(50000)
        assert shared_again["systemView"]["visible"]
        assert shared_again["recentViews"] == recorded, "Shared return replaced a member observation"
        capture(page, f"systems-local-returned-from-{target.lower()}", output, evidence)
    for quality in ("standard", "immersive", "safe"):
        previous = steady(50000)
        page.get_by_test_id("open-quality").click()
        page.get_by_test_id(f"quality-{quality}").check()
        page.wait_for_function("key => window.__universeObservatoryState?.budget?.key === key", arg=quality)
        page.get_by_test_id("close-quality").press("Enter")
        current = steady(50000)
        for field in pose_fields:
            assert current[field] == previous[field], f"Quality moved local view {field}"
        assert current["systemView"]["scope"] == "local"
        capture(page, f"systems-local-quality-{quality}", output, evidence)
    for language in ("zh", "en"):
        for width, height, label in [(390, 844, "portrait"), (844, 390, "landscape")]:
            page.emulate_media(reduced_motion="reduce")
            page.set_viewport_size({"width": width, "height": height})
            page.goto(configured_url(url, debug=1, lang=language, target="Sol", budget=report["qualityProfile"]), wait_until="networkidle")
            wait_ready(page, errors)
            entry = guide_control(page, 'guide-local-system')
            entry.wait_for(state="visible")
            assert entry.is_visible() and entry.inner_text().strip()
            box = entry.bounding_box()
            assert box and 0 <= box["x"] and box["x"] + box["width"] <= width and box["y"] + box["height"] <= height
            capture(page, f"systems-local-{language}-{label}-entry", output, evidence)
            entry.press("Enter")
            shared = steady(50000)
            assert shared["systemView"]["visible"] and shared["sceneMotion"]["rate"] == 0
            area = shared["observationArea"]
            for identity in (50000, 50003):
                body = next(t for t in shared["visibleTargets"] if t["id"] == identity)
                assert area["x"] <= body["x"] <= area["x"] + area["width"]
                assert area["y"] <= body["y"] <= area["y"] + area["height"]
            capture(page, f"systems-local-{language}-{label}-shared", output, evidence)
            family()
            assert page.get_by_test_id("local-system-50000").is_visible()
            assert page.get_by_test_id("local-system-50000").get_attribute("aria-current") == "true"
            assert page.get_by_test_id("system-overview").get_attribute("aria-current") == "false"
            page.keyboard.press("Escape")
            page.get_by_test_id("return-overview").press("Enter")
            assert steady(50000)["scaleStage"] == "Galactic"
            capture(page, f"systems-local-{language}-{label}-returned", output, evidence)
    assert not errors, errors
    page.close()
    evidence.update(status="passed", errors=errors, finiteFamily=True, memberIds=sorted(member_ids),
        browsingDoesNotMoveCamera=True, stopAndContinue=True, canvasMemberPick=True,
        nestedSatelliteKeyboard=True, returnFromNearBody=True, actualPng=True,
        fixedLensZoom=True, qualityPreservesWorldPose=True, responsiveAndBilingual=True,
        liveReducedMotion=True, ordinaryMapIdentityPreserved=True, guideEntryAndExit=True,
        configuredHomeIdentityPreserved=True, referenceMarkersKeepPickingIdentity=True)
    evidence.update(localSharedSpace=True, localMemberCanvasPick=True, localNearAndReturn=True,
                    localStopResume=True, localPausedRasterHeld=True, localPngRootPreserved=True,
                    localResponsiveBilingual=True, localQualityPreservesPose=True)


def run_motion(browser, url, output, report, Image, ImageChops, ImageStat):
    """The observation clock is independent of navigation; pixels support review."""
    errors = []
    evidence = {"captures": [], "events": [], "activityReviews": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["motionJourney"] = evidence
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "motion-video"), record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(configured_url(url, debug=1, lang="zh", target="Halley", budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").click()
    settled(page)
    page.get_by_test_id("hide-guide").click()
    full_observation(page)
    pose_fields = ("distance", "distanceTarget", "cameraYaw", "cameraPitch", "cameraRoll", "fov", "observedX", "observedY", "observedId", "activeId")

    def steady():
        settled(page)
        page.wait_for_function("() => { const s=window.__universeObservatoryState; return s && !s.flight && s.distance===s.distanceTarget; }")
        return state(page)

    def choose(mode):
        if not page.get_by_test_id("motion-flow").is_visible():
            page.get_by_test_id("open-dynamics").click()
        page.get_by_test_id(f"motion-{mode}").check()
        page.wait_for_function("mode => window.__universeObservatoryState?.sceneMotion?.mode === mode", arg=mode)
        assert page.get_by_test_id(f"motion-{mode}").is_checked()
        page.keyboard.press("Escape")
        assert not page.get_by_test_id("destinations").is_visible()
        assert page.get_by_test_id("open-dynamics").evaluate("el => el === document.activeElement")
        return state(page)

    def hold(name, milliseconds=3200, paused=False):
        start = steady()
        capture(page, f"motion-{name}-start", output, evidence)
        before_overlays = scene_overlay_bounds(page)
        first = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
        if report["recordVideo"] and milliseconds >= 5000:
            for part in range(3):
                page.wait_for_timeout(milliseconds/3)
                capture(page, f"motion-{name}-part-{part+1}", output, evidence)
        else:
            page.wait_for_timeout(milliseconds)
        end = capture(page, f"motion-{name}-end", output, evidence)
        second = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
        for field in pose_fields:
            if field in ("observedX", "observedY") and not paused:
                assert math.isclose(end[field], start[field], rel_tol=0, abs_tol=1e-5), f"Moving anchor left the observation centre: {name}, {field}"
            else:
                assert end[field] == start[field], f"Activity changed the observation pose: {name}, {field}"
        region = (310, 155, first.width-60, first.height-90)
        difference = scene_pixel_difference(page, first, second, region, ImageChops, ImageStat, before_overlays)
        if paused:
            assert end["animationTime"] == start["animationTime"] and end["rotationPhase"] == start["rotationPhase"]
            assert end["observedPosition"] == start["observedPosition"]
            assert max(difference) < 0.05, f"Paused scene kept changing: {name}"
        else:
            assert end["animationTime"] > start["animationTime"]
            if end["observedKind"] in ("planet", "dwarfplanet", "moon", "comet", "star"):
                assert end["observedPosition"] != start["observedPosition"], f"Moving body stayed fixed: {name}"
        evidence["activityReviews"].append({"scene": name, "holdMs": milliseconds, "mode": end["sceneMotion"],
            "animationDelta": end["animationTime"]-start["animationTime"], "pixelDifference": difference,
            "observedPositions": [start["observedPosition"], end["observedPosition"]],
            "meaning": "No-input images and video for perceptual review; pixel changes alone do not establish visual quality."})
        return end

    page.get_by_test_id("lens-in").click()
    page.get_by_test_id("lens-in").click()
    hold("flowing-tails", 5000)
    before_pause = steady()
    paused = choose("paused")
    for field in pose_fields:
        if field in ("observedX", "observedY"):
            assert math.isclose(paused[field], before_pause[field], rel_tol=0, abs_tol=1e-5)
        else:
            assert paused[field] == before_pause[field]
    hold("paused-tails", 1800, paused=True)
    page.get_by_test_id("scale-Surface").click()
    close = steady()
    assert close["sceneMotion"]["rate"] == 0 and close["distance"] < paused["distance"]
    hold("paused-nucleus", 1000, paused=True)
    for quality in ("safe", "standard", "immersive"):
        before = state(page)
        page.get_by_test_id("open-quality").click()
        radio = page.get_by_test_id(f"quality-{quality}")
        if not radio.is_checked():
            radio.check()
        page.wait_for_function("key => window.__universeObservatoryState?.quality?.key === key", arg=quality)
        page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
        page.keyboard.press("Escape")
        after = state(page)
        assert after["sceneMotion"] == before["sceneMotion"] and after["animationTime"] == before["animationTime"]
        for field in pose_fields:
            assert after[field] == before[field]
        capture(page, f"motion-paused-quality-{quality}", output, evidence)
    assert choose("flow")["animationTime"] >= close["animationTime"]
    hold("rotating-nucleus", 6500)
    choose("accelerated")
    accelerated = hold("accelerated-nucleus", 2400)
    assert accelerated["sceneMotion"]["rate"] == 4
    identity = accelerated["observedId"]
    for _ in range(3):
        now = state(page)
        page.mouse.move(now["observedX"], now["observedY"])
        page.wait_for_function("id => window.__universeObservatoryState?.hoveredId === id", arg=identity)
        # A body label is also a valid target. Probe diagonal empty space so it
        # cannot land on the caption immediately to the right of the nucleus.
        page.mouse.move(now["observedX"]+now["bodyExtentPx"]*1.7, now["observedY"]+now["bodyExtentPx"]*0.9)
        page.wait_for_function("id => window.__universeObservatoryState?.hoveredId !== id", arg=identity)
        page.wait_for_timeout(250)
    choose("paused")
    save_observation(page, "motion-comet", output, evidence, Image, ImageStat, pause_ms=1000)
    assert state(page)["sceneMotion"]["mode"] == "paused"
    choose("accelerated")
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.reduced === true")
    reduced = hold("reduced-preference", 1300, paused=True)
    assert reduced["sceneMotion"]["mode"] == "accelerated" and reduced["sceneMotion"]["rate"] == 0
    page.get_by_test_id("open-dynamics").click()
    assert page.get_by_test_id("motion-accelerated").is_checked() and page.get_by_test_id("motion-accelerated").is_disabled()
    page.keyboard.press("Escape")
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.rate === 4")
    choose("flow")

    for target, name, stage, duration in (("Andromeda Galaxy", "rotating-galaxy", None, 6500),
                                          ("Jupiter", "moving-cloud-world", None, 4500),
                                          ("Earth", "tracking-ocean-world", None, 5500),
                                          ("Moon", "tracking-satellite", None, 5500),
                                          ("Orion Nebula", "flowing-nebula", None, 3500),
                                          ("Sol", "galactic-dust", "Galactic", 6500)):
        paused_flight_time = choose("paused")["animationTime"] if target == "Andromeda Galaxy" else None
        page.get_by_test_id("open-destinations").click()
        page.get_by_test_id("star-search").fill(target)
        page.get_by_test_id("destinations").locator(f'button[data-target="{target}"]:visible').click()
        steady()
        if paused_flight_time is not None:
            assert state(page)["animationTime"] == paused_flight_time and state(page)["observed"] == target
            choose("flow")
            # Observe the actual disc, then its finite interior lights. Orbit is
            # explicit input; the activity clock must not carry the camera.
            scene = page.get_by_test_id("star-map")
            for _ in range(8):
                scene.press("ArrowDown")
            page.wait_for_timeout(450)
            scene.press("Escape")
        if stage:
            page.get_by_test_id(f"scale-{stage}").click()
            steady()
        hold(name, duration)
        choose("paused")
        hold(f"paused-{name}", 700, paused=True)
        choose("flow")
        if target == "Andromeda Galaxy":
            page.get_by_test_id("scale-slider").press("End")
            hold("galaxy-local-lights", 5500)
            choose("paused")
            hold("paused-galaxy-local-lights", 1000, paused=True)
            choose("flow")

    # The same complete journey now covers no-input activity at both ends of
    # the scale travel. Navigation remains explicit while the clock flows.
    page.get_by_test_id("scale-LocalSystem").click()
    hold("solar-system-outflow", 6500)
    page.get_by_test_id("scale-slider").press("End")
    hold("solar-coronal-arcs", 9000)
    choose("paused")
    hold("paused-solar-arcs", 1500, paused=True)
    page.get_by_test_id("star-map").press("ArrowRight")
    page.get_by_test_id("star-map").press("Escape")
    steady()
    hold("paused-solar-orbit", 800, paused=True)
    choose("flow")
    hold("resumed-solar-arcs", 5500)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.rate===0")
    hold("reduced-solar-arcs", 1000, paused=True)
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.rate===1")
    page.get_by_test_id("return-overview").click()
    returned=steady()
    assert returned["scaleStage"]=="Galactic" and returned["activeId"]==0
    hold("living-galaxy-return", 6000)

    # Pick a named star in its current projection while the common galactic
    # space flows, then observe it through the same close-view and pause path.
    page.get_by_test_id("scale-Regional").click()
    regional = steady()
    assert regional["scaleStage"] == "Regional"
    point = next(target for target in regional["visibleTargets"] if target["id"] == 4)
    page.mouse.move(point["x"], point["y"])
    page.wait_for_function("window.__universeObservatoryState?.hoveredId===4")
    point = next(target for target in state(page)["visibleTargets"] if target["id"] == 4)
    page.get_by_test_id("star-map").click(position={"x":point["x"], "y":point["y"]})
    assert steady()["observedId"] == 4
    hold("tracking-picked-galactic-star", 5500)
    choose("paused")
    hold("paused-picked-galactic-star", 1000, paused=True)
    page.get_by_test_id("star-map").press("ArrowRight")
    page.get_by_test_id("star-map").press("Escape")
    steady()
    hold("paused-star-user-orbit", 700, paused=True)
    choose("flow")
    page.get_by_test_id("return-overview").click()
    assert steady()["activeId"] == 4
    hold("picked-star-map-return", 4000)

    # An explicitly configured generated identity is kept drawn at every
    # quality. It follows the same motion without a catalog-sized pose upload.
    page.goto(configured_url(url, debug=1, lang="en", target="UO 01512", catalog=50000,
                             budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    assert state(page)["activeId"] == 512
    page.get_by_test_id("approach-target").click()
    steady()
    page.get_by_test_id("hide-guide").click()
    full_observation(page)
    hold("tracking-generated-galactic-star", 5000)
    choose("paused")
    hold("paused-generated-galactic-star", 1000, paused=True)
    for quality in ("safe", "standard", "immersive"):
        before = steady()
        page.get_by_test_id("open-quality").click()
        page.get_by_test_id(f"quality-{quality}").check()
        page.wait_for_function("key => window.__universeObservatoryState?.quality?.key===key", arg=quality)
        page.keyboard.press("Escape")
        after = steady()
        assert after["observedId"] == after["activeId"] == 512
        assert after["observedPosition"] == before["observedPosition"] and after["animationTime"] == before["animationTime"]
        for field in pose_fields:
            assert after[field] == before[field]
        capture(page, f"motion-generated-star-quality-{quality}", output, evidence)
    choose("flow")
    page.get_by_test_id("return-overview").click()
    assert steady()["activeId"] == 512
    hold("generated-star-map-return", 4000)

    for dimensions, lang in (({"width":390,"height":844},"zh"), ({"width":844,"height":390},"en")):
        page.set_viewport_size(dimensions)
        page.goto(configured_url(url, debug=1, lang=lang, target="Halley", budget=report["qualityProfile"]), wait_until="networkidle")
        wait_ready(page, errors)
        page.get_by_test_id("open-destinations").click()
        page.get_by_test_id("navigation-dynamics").press("Enter")
        assert not page.get_by_test_id("star-search").is_visible()
        for mode in ("paused", "accelerated", "flow"):
            box = page.get_by_test_id(f"motion-{mode}").bounding_box()
            assert box and box["y"] >= 0 and box["y"]+box["height"] < dimensions["height"]
            page.get_by_test_id(f"motion-{mode}").check()
            page.wait_for_function("mode => window.__universeObservatoryState?.sceneMotion?.mode === mode", arg=mode)
        capture(page, f"motion-controls-{lang}-{dimensions['width']}", output, evidence)
        page.keyboard.press("Escape")
        assert page.get_by_test_id("navigation-dynamics").evaluate("el => el === document.activeElement") is False
        # Its entry is in the closed panel: restore to a reachable global control.
        assert page.get_by_test_id("open-dynamics").evaluate("el => el === document.activeElement")
        page.get_by_test_id("open-dynamics").click()
        page.get_by_test_id("navigation-browse").press("Enter")
        assert page.get_by_test_id("star-search").is_visible()
        page.get_by_test_id("browse-comet").click()
        page.get_by_test_id("destination-halley").press("Enter")
        assert steady()["observedKind"] == "comet"
    # A paused early observation must keep the same scene when the live motion
    # preference changes. Entry feedback cannot be tied to the scene clock.
    page.set_viewport_size({"width": 1280, "height": 720})
    page.emulate_media(reduced_motion="reduce")
    page.goto(configured_url(url, debug=1, lang="en", target="Sol", budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("hide-guide").click()
    full_observation(page)
    assert state(page)["animationTime"] == 0
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.reduced === false")
    choose("paused")
    early = steady()
    overlays = scene_overlay_bounds(page)
    before = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    capture(page, "motion-early-paused-normal", output, evidence)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.reduced === true")
    after = steady()
    for field in (*pose_fields, "animationTime", "observedPosition"):
        assert early[field] == after[field], field
    difference = scene_pixel_difference(page, before, Image.open(io.BytesIO(page.screenshot())).convert("RGB"),
                                       (0, 0, 1280, 720), ImageChops, ImageStat, overlays)
    assert max(difference) < 0.05, "Live motion preference replayed entry exposure on the paused scene."
    capture(page, "motion-early-paused-reduced", output, evidence)
    evidence["pausedPreferenceContinuity"] = {"animationTime": early["animationTime"], "pixelDifference": difference,
                                             "poseAndClockUnchanged": True}
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.reduced === false")
    choose("flow")
    evidence.update(status="passed", errors=errors, clockIndependentOfCamera=True, pausedNavigation=True,
                    resumedPhase=True, acceleratedAndReduced=True, currentSolidPicking=True, actualExport=True,
                    compactBilingualNavigation=True, movingNamedStarCanvasPick=True, generatedStarMotionAndQuality=True)
    assert not errors, errors
    page.close()


def run_blackholes(browser, url, output, report, Image, ImageChops, ImageStat):
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["blackholeJourney"] = evidence
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "blackhole-video"), record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, lang="zh", target="Crab Pulsar", seed=728281,
                          catalog=50000, budget=report["qualityProfile"])
    pose_fields = ("distance", "cameraYaw", "cameraPitch", "cameraRoll", "observedId", "activeId")

    def steady():
        settled(page)
        page.wait_for_function("""() => {const s=window.__universeObservatoryState;
          return s && !s.flight && s.observedId===s.activeId && s.navigationState!=='flying';}""", timeout=20000)
        return settled(page)

    def choose(mode):
        page.get_by_test_id("open-dynamics").click()
        page.get_by_test_id(f"motion-{mode}").check()
        page.wait_for_function("mode => window.__universeObservatoryState?.sceneMotion?.mode===mode", arg=mode)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        return state(page)

    page.emulate_media(reduced_motion="reduce")
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").click()
    before = steady()
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-blackhole").press("Enter")
    assert page.get_by_test_id("browse-blackhole").get_attribute("aria-pressed") == "true"
    for alias in ("黑洞", "射手座", "Sgr A*", "Sagittarius A"):
        page.get_by_test_id("star-search").fill(alias)
        assert page.get_by_test_id("destination-sagittarius-a").is_visible()
        for field in pose_fields:
            assert state(page)[field] == before[field]
    page.get_by_test_id("star-search").fill("")
    capture(page, "blackhole-category-discovery", output, evidence)
    page.emulate_media(reduced_motion="no-preference")
    page.get_by_test_id("destination-sagittarius-a").click()
    page.wait_for_function("window.__universeObservatoryState?.flightPhase==='departing'")
    capture(page, "blackhole-leaving-remnant", output, evidence)
    page.get_by_test_id("stop-flight").click()
    page.wait_for_function("window.__universeObservatoryState?.navigationState==='paused'")
    stopped = state(page)
    page.wait_for_timeout(500)
    assert state(page)["navigationState"] == "paused"
    assert state(page)["observedId"] == before["observedId"]
    for field in pose_fields:
        assert state(page)[field] == stopped[field]
    capture(page, "blackhole-flight-stopped", output, evidence)
    page.get_by_test_id("resume-flight").click()
    for phase in ("crossing", "approaching"):
        page.wait_for_function("phase => window.__universeObservatoryState?.flightPhase===phase", arg=phase)
        capture(page, f"blackhole-flight-{phase}", output, evidence)
    whole = steady()
    identity = whole["activeId"]
    assert whole["activeKind"] == whole["observedKind"] == "blackhole"
    assert whole["scaleStage"] == "LocalSystem" and whole["blackholeDraw"] >= 1
    capture(page, "blackhole-arrival-disk", output, evidence)
    page.get_by_test_id("hide-guide").click()
    full_observation(page)
    scene = page.get_by_test_id("star-map")
    scene.hover()
    hold = state(page)
    for index in range(3):
        page.wait_for_timeout(1200)
        current = capture(page, f"blackhole-flowing-disk-{index}", output, evidence)
        for field in pose_fields:
            assert current[field] == hold[field]
        assert current["animationTime"] > hold["animationTime"]
    paused = choose("paused")
    before_overlays = scene_overlay_bounds(page)
    first = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    page.wait_for_timeout(700)
    second = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    difference = scene_pixel_difference(page, first, second, (100,130,1150,590), ImageChops, ImageStat, before_overlays)
    pause_end = state(page)
    evidence["pauseEvidence"] = {"pixelDifference": difference, "diagnosticTextExcluded": True, "interfaceFeedbackExcluded": True,
                                 "animationTimes": [paused["animationTime"], pause_end["animationTime"]]}
    if max(difference) >= 0.05 or pause_end["animationTime"] != paused["animationTime"]:
        first.save(output / "blackhole-pause-first.png")
        second.save(output / "blackhole-pause-second.png")
    assert max(difference) < 0.05 and pause_end["animationTime"] == paused["animationTime"], evidence["pauseEvidence"]
    for field in (*pose_fields, "fov", "observedX", "observedY", "observedPosition"):
        assert pause_end[field] == paused[field], f"Pause changed {field}"
    evidence["pausedPixelDifference"] = difference
    for key in ("safe", "standard", "immersive"):
        previous = state(page)
        page.get_by_test_id("open-quality").click()
        radio = page.get_by_test_id(f"quality-{key}")
        if not radio.is_checked():
            radio.check()
        page.wait_for_function("key => window.__universeObservatoryState?.quality?.key===key", arg=key)
        page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
        page.keyboard.press("Escape")
        current = steady()
        for field in (*pose_fields, "animationTime", "fov"):
            assert current[field] == previous[field]
        capture(page, f"blackhole-paused-quality-{key}", output, evidence)
    choose("flow")
    page.wait_for_timeout(1300)
    capture(page, "blackhole-resumed-disk", output, evidence)
    choose("accelerated")
    if report["recordVideo"]:
        for index in range(3):
            page.wait_for_timeout(10000)
            capture(page, f"blackhole-extended-flow-{index}", output, evidence)
    page.wait_for_timeout(1200)
    capture(page, "blackhole-accelerated-disk", output, evidence)
    choose("paused")
    fixed = state(page)
    for index in range(3):
        scene.hover(); page.mouse.wheel(0, -180)
        current = steady()
        assert current["observedId"] == identity
        for field in ("cameraYaw", "cameraPitch", "cameraRoll", "fov"):
            assert current[field] == fixed[field]
        assert abs(current["observedX"] - 640) < 1 and abs(current["observedY"] - 360) < 1
        capture(page, f"blackhole-approach-{index}", output, evidence)
    page.get_by_test_id("scale-slider").press("End")
    closest = steady()
    assert closest["scaleStage"] == "Surface" and closest["distance"] < whole["distance"]
    capture(page, "blackhole-closest-shadow", output, evidence)
    page.mouse.move(closest["observedX"], closest["observedY"])
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId===id", arg=identity)
    page.mouse.move(closest["observedX"] + closest["starRadiusPx"] * 2, closest["observedY"] + closest["starRadiusPx"] * .7)
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId!==id", arg=identity)
    for label, key, count in (("face", "ArrowDown", 13), ("edge", "ArrowUp", 18), ("inclined", "ArrowDown", 5)):
        for _ in range(count):
            scene.press(key)
            if report["recordVideo"]:
                page.wait_for_timeout(40)
        scene.press("Escape");current=steady()
        assert current["observedId"] == identity and current["distance"] == closest["distance"]
        capture(page, f"blackhole-orbit-{label}", output, evidence)
    page.get_by_test_id("restore-guide").click()
    steady()
    toggle_reading(page)
    assert page.get_by_test_id("target-source").get_attribute("href") == "https://science.nasa.gov/universe/black-holes/anatomy/"
    assert page.get_by_test_id("space-source").get_attribute("href").startswith("https://science.nasa.gov/mission/webb/")
    capture(page, "blackhole-scientific-context", output, evidence)
    toggle_reading(page)
    memory = steady()
    save_observation(page, "blackhole-disk", output, evidence, Image, ImageStat, pause_ms=500)
    guide_control(page, 'next-observation').click()
    comparison = steady()
    assert comparison["observed"] == "Crab Pulsar" and comparison["animationTime"] == memory["animationTime"]
    capture(page, "blackhole-remnant-comparison", output, evidence)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-featured").click()
    page.get_by_test_id(f"revisit-{identity}").click()
    recalled = steady()
    for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll"):
        assert math.isclose(recalled[field], memory[field], rel_tol=1e-7, abs_tol=1e-9)
    capture(page, "blackhole-revisited-shadow", output, evidence)
    choose("accelerated")
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.reduced===true")
    reduced=state(page);page.wait_for_timeout(700)
    assert reduced["sceneMotion"]["mode"] == "accelerated" and state(page)["animationTime"] == reduced["animationTime"]
    capture(page, "blackhole-live-reduced-motion", output, evidence)
    for dimensions,lang in (({"width":390,"height":844},"zh"), ({"width":844,"height":390},"en"), ({"width":320,"height":640},"zh")):
        page.set_viewport_size(dimensions)
        page.goto(configured_url(base, lang=lang, target="Sgr A*"), wait_until="networkidle")
        wait_ready(page,errors)
        page.get_by_test_id("open-destinations").click()
        page.get_by_test_id("browse-blackhole").press("Enter")
        entry=page.get_by_test_id("destination-sagittarius-a");box=entry.bounding_box()
        assert box and 0<=box["y"] and box["y"]+box["height"]<dimensions["height"]
        entry.press("Enter");steady()
        page.get_by_test_id("scale-slider").press("End");current=steady()
        area=current["observationArea"]
        for position,size,axis,extent in ((current["observedX"],current["bodyExtentPx"],"x","width"),(current["observedY"],current["bodyExtentPx"],"y","height")):
            assert position-size>=area[axis]-1 and position+size<=area[axis]+area[extent]+1
        capture(page,f"blackhole-reading-{lang}-{dimensions['width']}",output,evidence)
    page.set_viewport_size({"width":1280,"height":720})
    page.emulate_media(reduced_motion="no-preference")
    page.get_by_test_id("return-overview").click()
    for index,delay in enumerate((200,400,600)):
        page.wait_for_timeout(delay);capture(page,f"blackhole-return-{index}",output,evidence)
    returned=steady()
    assert returned["activeId"] == returned["observedId"] == identity and returned["scaleStage"] == "Galactic"
    evidence.update(status="passed", errors=errors, aliasesAndCategory=True, fixedCentredLens=True,
                    transparentDiskPicking=True, activityAndQualityPreserved=True, comparisonAndRevisit=True,
                    responsiveReading=True, actualPng=True, reducedMotion=True, returnPreservesIdentity=True)
    assert not errors, errors
    page.close()


def run_pulsars(browser, url, output, report, Image, ImageChops, ImageStat):
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["pulsarJourney"] = evidence
    options = {"viewport": {"width": 1400, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "pulsar-video"), record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, lang="zh", target="Moon", seed=728281,
                          catalog=50000, budget=report["qualityProfile"])
    pose_fields = ("distance", "cameraYaw", "cameraPitch", "cameraRoll", "observedId", "activeId")

    def steady():
        settled(page)
        page.wait_for_function("""() => {const s=window.__universeObservatoryState;
          return s && !s.flight && s.observedId===s.activeId && s.navigationState!=='flying';}""", timeout=20000)
        return settled(page)

    def choose(mode):
        page.get_by_test_id("open-dynamics").click()
        page.get_by_test_id(f"motion-{mode}").check()
        page.wait_for_function("mode => window.__universeObservatoryState?.sceneMotion?.mode===mode", arg=mode)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        return state(page)

    page.emulate_media(reduced_motion="reduce")
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").click()
    moon = steady()
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-pulsar").click()
    assert page.get_by_test_id("browse-pulsar").get_attribute("aria-pressed") == "true"
    assert page.get_by_test_id("destination-crab-pulsar").is_visible()
    for field in pose_fields:
        assert state(page)[field] == moon[field]
    for alias in ("蟹状", "PSR B0531+21", "crab"):
        page.get_by_test_id("star-search").fill(alias)
        assert page.get_by_test_id("destination-crab-pulsar").is_visible()
    page.get_by_test_id("star-search").fill("")
    capture(page, "pulsar-category-discovery", output, evidence)
    page.emulate_media(reduced_motion="no-preference")
    page.get_by_test_id("destination-crab-pulsar").click()
    page.wait_for_function("window.__universeObservatoryState?.flightPhase==='departing'")
    capture(page, "pulsar-leaving-moon", output, evidence)
    page.get_by_test_id("stop-flight").click()
    page.wait_for_timeout(300)
    stopped = capture(page, "pulsar-flight-stopped", output, evidence)
    assert stopped["observedId"] == moon["observedId"] and stopped["activeKind"] == "pulsar"
    page.wait_for_timeout(500)
    assert state(page)["navigationState"] == "paused"
    for field in pose_fields:
        assert state(page)[field] == stopped[field]
    page.get_by_test_id("resume-flight").click()
    for phase in ("crossing", "approaching"):
        page.wait_for_function("phase => window.__universeObservatoryState?.flightPhase===phase", arg=phase)
        capture(page, f"pulsar-flight-{phase}", output, evidence)
    whole = steady()
    identity = whole["activeId"]
    assert whole["activeKind"] == whole["observedKind"] == "pulsar"
    assert whole["scaleStage"] == "LocalSystem" and whole["pulsarDraw"] >= 1
    capture(page, "pulsar-whole-illustration", output, evidence)
    page.get_by_test_id("hide-guide").click()
    full_observation(page)
    scene = page.get_by_test_id("star-map")
    scene.hover()
    hold = state(page)
    for index in range(3):
        page.wait_for_timeout(1400)
        current = capture(page, f"pulsar-flowing-beams-{index}", output, evidence)
        for field in pose_fields:
            assert current[field] == hold[field]
        assert current["animationTime"] > hold["animationTime"]
    paused = choose("paused")
    before_overlays = scene_overlay_bounds(page)
    first = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    page.wait_for_timeout(700)
    second = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    difference = scene_pixel_difference(page, first, second, (100,130,1300,780), ImageChops, ImageStat, before_overlays)
    pause_end = state(page)
    evidence["pauseEvidence"] = {"pixelDifference": difference, "diagnosticTextExcluded": True, "interfaceFeedbackExcluded": True,
                                 "animationTimes": [paused["animationTime"], pause_end["animationTime"]]}
    if max(difference) >= 0.05 or pause_end["animationTime"] != paused["animationTime"]:
        first.save(output / "pulsar-pause-first.png")
        second.save(output / "pulsar-pause-second.png")
    assert max(difference)<0.05 and pause_end["animationTime"] == paused["animationTime"], evidence["pauseEvidence"]
    for field in (*pose_fields, "fov", "observedX", "observedY", "observedPosition"):
        assert pause_end[field] == paused[field], f"Pause changed {field}"
    evidence["pausedPixelDifference"] = difference
    capture(page, "pulsar-paused-beams", output, evidence)
    for key in ("safe", "standard", "immersive"):
        before = state(page)
        page.get_by_test_id("open-quality").click()
        radio = page.get_by_test_id(f"quality-{key}")
        if not radio.is_checked():
            radio.check()
        page.wait_for_function("key => window.__universeObservatoryState?.quality?.key===key", arg=key)
        page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
        page.keyboard.press("Escape")
        current = steady()
        for field in (*pose_fields, "animationTime", "fov"):
            assert current[field] == before[field]
        capture(page, f"pulsar-paused-quality-{key}", output, evidence)
    resumed = choose("flow")
    assert resumed["animationTime"] >= paused["animationTime"]
    page.wait_for_timeout(1800)
    capture(page, "pulsar-resumed-beams", output, evidence)
    choose("accelerated")
    page.wait_for_timeout(1300)
    capture(page, "pulsar-accelerated-beams", output, evidence)
    choose("paused")
    saved_whole = state(page)
    save_observation(page, "pulsar-beams", output, evidence, Image, ImageStat, pause_ms=500)
    assert state(page)["animationTime"] == saved_whole["animationTime"]
    fixed = state(page)
    for index in range(5):
        scene.hover()
        page.mouse.wheel(0,-250)
        current=steady()
        assert current["observedId"] == identity
        for field in ("cameraYaw", "cameraPitch", "cameraRoll", "fov"):
            assert current[field] == fixed[field]
        assert abs(current["observedX"]-700)<1 and abs(current["observedY"]-450)<1
        capture(page, f"pulsar-approach-{index}", output, evidence)
    page.get_by_test_id("scale-slider").press("End")
    core = steady()
    assert core["scaleStage"] == "Surface" and core["distance"] < whole["distance"]
    capture(page, "pulsar-closest-core", output, evidence)
    page.mouse.move(core["observedX"],core["observedY"])
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId===id", arg=identity)
    page.mouse.move(core["observedX"]+core["starRadiusPx"]*1.5,core["observedY"]+core["starRadiusPx"]*0.75)
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId!==id", arg=identity)
    page.mouse.move(800,400);page.mouse.down();page.mouse.move(1090,500,steps=24);page.mouse.up()
    page.wait_for_timeout(400);scene.press("Escape")
    orbited=steady()
    assert orbited["observedId"] == identity and orbited["cameraYaw"] != core["cameraYaw"]
    capture(page, "pulsar-orbited-core", output, evidence)
    page.get_by_test_id("restore-guide").click()
    steady()
    toggle_reading(page)
    source=page.get_by_test_id("target-source")
    assert source.get_attribute("href") == "https://science.nasa.gov/missions/hubble/the-crab-nebula/"
    observation_source=page.get_by_test_id("target-observation-source")
    assert observation_source.is_visible() and observation_source.get_attribute("href").startswith("https://")
    capture(page, "pulsar-scientific-context", output, evidence)
    toggle_reading(page)
    steady()
    memory = state(page)
    guide_control(page, 'next-observation').click()
    sun = steady()
    assert sun["observed"] == "Sol" and sun["animationTime"] == memory["animationTime"]
    capture(page, "pulsar-solar-comparison", output, evidence)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-featured").click()
    page.get_by_test_id(f"revisit-{identity}").click()
    page.wait_for_function("id => {const s=window.__universeObservatoryState; return s?.observedId===id && !s.revisiting && !s.flight;}", arg=identity, timeout=20000)
    recalled=steady()
    for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll"):
        assert math.isclose(recalled[field],memory[field],rel_tol=1e-7,abs_tol=1e-9)
    capture(page, "pulsar-revisited-core", output, evidence)
    choose("accelerated")
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.reduced===true")
    reduced=state(page);page.wait_for_timeout(700)
    assert reduced["sceneMotion"]["mode"] == "accelerated" and state(page)["animationTime"] == reduced["animationTime"]
    capture(page, "pulsar-live-reduced-motion", output, evidence)
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.rate===4")
    choose("flow")
    for dimensions,lang in (({"width":390,"height":844},"zh"), ({"width":844,"height":390},"en"), ({"width":320,"height":640},"zh")):
        page.set_viewport_size(dimensions)
        page.emulate_media(reduced_motion="reduce")
        page.goto(configured_url(base,lang=lang,target="PSR B0531+21"),wait_until="networkidle")
        wait_ready(page,errors)
        page.get_by_test_id("open-destinations").click()
        page.get_by_test_id("browse-pulsar").click()
        entry=page.get_by_test_id("destination-crab-pulsar");box=entry.bounding_box()
        assert box and 0<=box["y"] and box["y"]+box["height"]<dimensions["height"]
        capture(page,f"pulsar-category-{lang}-{dimensions['width']}",output,evidence)
        entry.press("Enter");steady()
        capture(page,f"pulsar-beams-{lang}-{dimensions['width']}",output,evidence)
        page.get_by_test_id("scale-slider").press("End");closest=steady()
        area=closest["observationArea"]
        for position,size,axis,extent in ((closest["observedX"],closest["bodyExtentPx"],"x","width"),(closest["observedY"],closest["bodyExtentPx"],"y","height")):
            assert position-size>=area[axis]-1 and position+size<=area[axis]+area[extent]+1
        capture(page,f"pulsar-reading-core-{lang}-{dimensions['width']}",output,evidence)
    page.set_viewport_size({"width":1400,"height":900})
    page.emulate_media(reduced_motion="no-preference")
    page.get_by_test_id("return-overview").click()
    for index,delay in enumerate((200,400,600)):
        page.wait_for_timeout(delay);capture(page,f"pulsar-return-{index}",output,evidence)
    returned=steady()
    assert returned["activeId"] == returned["observedId"] == identity and returned["scaleStage"] == "Galactic"
    evidence.update(status="passed",errors=errors,categoryAndBilingualAliases=True,stoppedAndResumed=True,
                    fixedLensAndCentredZoom=True,corePickingOnly=True,pausedAndResumedActivity=True,
                    qualityPoseAndPhasePreserved=True,actualPng=True,comparisonAndRevisit=True,
                    responsiveReading=True,liveReducedMotion=True,returnPreservesIdentity=True)
    assert not errors,errors
    page.close()


def run_comets(browser, url, output, report, Image, ImageChops, ImageStat):
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["cometJourney"] = evidence
    options = {"viewport": {"width": 1400, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "comet-video"), record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, lang="en", target="Moon", seed=728281, budget=report["qualityProfile"])
    page.emulate_media(reduced_motion="reduce")
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").click()
    moon = settled(page)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-comet").click()
    assert page.get_by_test_id("destination-halley").is_visible()
    assert state(page)["observedId"] == moon["observedId"]
    capture(page, "comet-discovered", output, evidence)
    page.emulate_media(reduced_motion="no-preference")
    page.get_by_test_id("destination-halley").click()
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    capture(page, "comet-departing-moon", output, evidence)
    page.get_by_test_id("stop-flight").click()
    page.wait_for_timeout(300)
    stopped = capture(page, "comet-flight-stopped", output, evidence)
    assert stopped["observedId"] == moon["observedId"] and stopped["activeKind"] == "comet"
    assert stopped["navigationState"] == "paused"
    page.wait_for_timeout(500)
    for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll", "observedId", "activeId"):
        assert state(page)[field] == stopped[field]
    page.get_by_test_id("resume-flight").click()
    for phase in ("departing", "crossing", "approaching"):
        page.wait_for_function("phase => window.__universeObservatoryState?.flightPhase === phase", arg=phase)
        capture(page, f"comet-flight-{phase}", output, evidence)
    whole = settled(page)
    identity = whole["activeId"]
    assert whole["activeKind"] == whole["observedKind"] == "comet"
    assert whole["observedId"] == identity and whole["scaleStage"] == "LocalSystem"
    assert whole["relations"]["parent"]["target"] == "Sol"
    assert guide_control(page, 'zoom-in').is_visible()
    capture(page, "comet-whole-tails", output, evidence)
    page.get_by_test_id("hide-guide").click()
    scene = page.get_by_test_id("star-map")
    pose = full_observation(page)
    scene.hover()
    for index in range(5):
        page.mouse.wheel(0,-250)
        current = settled(page)
        assert current["observedId"] == identity
        for field in ("cameraYaw", "cameraPitch", "cameraRoll", "fov"):
            assert current[field] == pose[field]
        assert abs(current["observedX"]-700)<1 and abs(current["observedY"]-450)<1
        capture(page, f"comet-approach-{index}", output, evidence)
    page.get_by_test_id("scale-Surface").click()
    nucleus = settled(page)
    assert nucleus["distance"] < whole["distance"] and nucleus["scaleStage"] == "Surface"
    capture(page, "comet-nucleus", output, evidence)
    assert nucleus["surfaceInspection"]["kind"] == "nucleus"
    page.wait_for_function("() => window.__universeObservatoryState.surfaceInspection.available")
    page.get_by_test_id("inspect-surface").press("Enter")
    page.wait_for_function("() => window.__universeObservatoryState.surfaceInspection.available && window.__universeObservatoryState.surfaceInspection.close")
    local = capture(page, "comet-local-nucleus", output, evidence)
    assert local["distance"] < nucleus["distance"]
    for field in ("activeId", "observedId", "cameraYaw", "cameraPitch", "cameraRoll", "fov"):
        assert local[field] == nucleus[field]
    page.get_by_test_id("inspect-surface").press("Enter")
    page.wait_for_function("() => window.__universeObservatoryState.surfaceInspection.available && !window.__universeObservatoryState.surfaceInspection.close")
    recovered = capture(page, "comet-whole-nucleus-recovered", output, evidence)
    assert math.isclose(recovered["distance"], nucleus["distance"], rel_tol=1e-9)
    for field in ("activeId", "observedId", "cameraYaw", "cameraPitch", "cameraRoll", "fov"):
        assert recovered[field] == nucleus[field]
    # Empty space inside the old circular point hit area is outside this solid.
    page.mouse.move(nucleus["observedX"],nucleus["observedY"]+nucleus["starRadiusPx"]*0.9)
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId !== id",arg=identity)
    page.mouse.move(850,400)
    page.mouse.down()
    page.mouse.move(1110,480,steps=24)
    page.mouse.up()
    page.wait_for_timeout(350)
    scene.press("Escape")
    orbited = settled(page)
    assert orbited["observedId"] == identity and orbited["cameraYaw"] != nucleus["cameraYaw"]
    assert abs(orbited["observedX"]-700)<1 and abs(orbited["observedY"]-450)<1
    capture(page, "comet-orbited-nucleus", output, evidence)
    page.mouse.move(orbited["observedX"],orbited["observedY"])
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId === id",arg=identity)
    page.mouse.move(orbited["observedX"]+orbited["bodyExtentPx"]*1.7,orbited["observedY"])
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId !== id",arg=identity)
    for key in ("safe", "standard", "immersive"):
        before = state(page)
        page.get_by_test_id("open-quality").click()
        radio = page.get_by_test_id(f"quality-{key}")
        if not radio.is_checked():
            radio.check()
        page.wait_for_function("key => window.__universeObservatoryState?.quality?.key === key",arg=key)
        page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
        page.keyboard.press("Escape")
        current = settled(page)
        for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll", "observedId", "activeId"):
            assert current[field] == before[field]
        capture(page,f"comet-quality-{key}",output,evidence)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(300)
    frozen = state(page)
    first = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    page.wait_for_timeout(500)
    second = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    freeze_difference = ImageStat.Stat(ImageChops.difference(first.crop((390,130,1200,720)),second.crop((390,130,1200,720)))).mean
    assert max(freeze_difference)<0.05 and state(page)["animationTime"] == frozen["animationTime"]
    save_observation(page,"comet-nucleus",output,evidence,Image,ImageStat,pause_ms=300)
    page.get_by_test_id("restore-guide").click()
    toggle_reading(page)
    source = page.get_by_test_id("target-details").get_by_role("link")
    assert source.get_attribute("href") == "https://science.nasa.gov/solar-system/comets/1p-halley/"
    capture(page,"comet-science-source",output,evidence)
    toggle_reading(page)
    page.wait_for_timeout(250)
    saved = state(page)
    guide_section(page, 'related')
    page.get_by_test_id("body-relations").locator('button[data-target="Sol"]:visible').click()
    solar = settled(page)
    assert solar["observed"] == "Sol"
    guide_section(page, 'related')
    assert page.get_by_test_id("body-relations").locator('button[data-target="Halley\'s Comet"]:visible').is_visible()
    capture(page,"comet-solar-relation",output,evidence)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-featured").click()
    page.get_by_test_id(f"revisit-{identity}").click()
    recalled = settled(page)
    for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll"):
        assert math.isclose(recalled[field],saved[field],rel_tol=1e-7,abs_tol=1e-9)
    assert recalled["observedId"] == identity
    capture(page,"comet-revisited",output,evidence)
    page.set_viewport_size({"width":390,"height":844})
    page.goto(configured_url(base,lang="zh",target="1P/Halley"),wait_until="networkidle")
    wait_ready(page,errors)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-comet").click()
    search = page.get_by_test_id("star-search")
    search.fill("哈雷")
    search.press("Enter")
    narrow = settled(page)
    assert narrow["observedId"] == identity and narrow["scaleStage"] == "LocalSystem"
    capture(page,"comet-narrow-tails",output,evidence)
    toggle_reading(page)
    page.get_by_test_id("scale-slider").focus()
    page.get_by_test_id("scale-slider").press("End")
    closest = settled(page)
    area = closest["observationArea"]
    assert closest["observedY"]+closest["bodyExtentPx"] <= area["y"]+area["height"]+1
    assert closest["observedY"]-closest["bodyExtentPx"] >= area["y"]-1
    capture(page,"comet-narrow-reading-nucleus",output,evidence)
    page.set_viewport_size({"width":844,"height":390})
    toggle_reading(page)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-comet").click()
    search.fill("")
    box = page.get_by_test_id("destination-halley").bounding_box()
    assert box and 0<=box["y"] and box["y"]+box["height"]<390
    capture(page,"comet-landscape-category",output,evidence)
    search.press("Escape")
    page.set_viewport_size({"width":1400,"height":900})
    page.emulate_media(reduced_motion="no-preference")
    page.get_by_test_id("return-overview").click()
    for index, delay in enumerate((200,450,650)):
        page.wait_for_timeout(delay)
        capture(page,f"comet-return-{index}",output,evidence)
    returned = settled(page)
    assert returned["activeId"] == returned["observedId"] == identity and returned["scaleStage"] == "Galactic"
    evidence.update(status="passed",errors=errors,categoryAndAliases=True,stoppedAndResumed=True,
                    centredApproachAndOrbit=True,opaqueNucleusOnly=True,qualityPosePreserved=True,
                    reducedPixelDifference=freeze_difference,sourceAndExport=True,solarRelationAndRevisit=True,
                    narrowReadingAndLandscape=True,returnedWithIdentity=True)
    assert not errors,errors
    page.close()


def run_nebula(browser, url, output, report, Image, ImageChops, ImageStat):
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["nebulaJourney"] = evidence
    errors = []
    options = {"viewport": {"width": 1400, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=output / "nebula-video", record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, seed=728281, budget=report["qualityProfile"], lang="en", target="Betelgeuse")
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").click()
    settled(page)
    capture(page, "nebula-departure-betelgeuse", output, evidence)
    guide_control(page, 'next-observation').press("Enter")
    page.wait_for_timeout(300)
    leaving = capture(page, "nebula-departing", output, evidence)
    assert leaving["active"] == "Orion Nebula" and leaving["observed"] == "Betelgeuse"
    scene = page.get_by_test_id("star-map")
    scene.press("Escape")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    assert state(page)["observed"] == "Betelgeuse"
    capture(page, "nebula-stopped-near-betelgeuse", output, evidence)
    page.get_by_test_id("approach-target").click()
    for name, delay in (("nebula-leaving-star", 650), ("nebula-crossing", 1050), ("nebula-approaching", 1400)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    arrived = settled(page)
    assert arrived["active"] == arrived["observed"] == "Orion Nebula"
    assert arrived["observedKind"] == "nebula" and not arrived["insideNebula"]
    capture(page, "nebula-outside", output, evidence)
    toggle_reading(page)
    assert page.get_by_test_id("target-details").get_by_role("link").get_attribute("href") == "https://www.jpl.nasa.gov/news/nasa-space-telescopes-provide-a-3-d-journey-through-the-orion-nebula/"
    toggle_reading(page)
    entry_start = timeline(evidence, "cloud-entry-start")
    guide_control(page, 'zoom-in').press("Enter")
    for name, delay in (("nebula-entry-outer", 180), ("nebula-entry-layers", 420), ("nebula-entry-core", 650)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    inside = settled(page)
    assert inside["insideNebula"] and inside["activeId"] == arrived["activeId"]
    capture(page, "nebula-inside", output, evidence)
    page.get_by_test_id("hide-guide").click()
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(400)
    frozen = state(page)
    before = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    page.wait_for_timeout(500)
    after = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    assert state(page)["animationTime"] == frozen["animationTime"]
    scene_box = (420, 200, 1080, 650)
    freeze_difference = ImageStat.Stat(ImageChops.difference(before.crop(scene_box), after.crop(scene_box))).mean
    assert max(freeze_difference) < 0.05, "cloud animation continued with reduced motion"
    scene.focus()
    for _ in range(6):
        scene.press("ArrowLeft")
    page.wait_for_timeout(400)
    orbited = capture(page, "nebula-inside-orbit", output, evidence)
    assert orbited["insideNebula"] and orbited["observedId"] == arrived["observedId"]
    turned = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    difference = ImageStat.Stat(ImageChops.difference(after, turned)).mean
    assert max(difference) > 0.5, "the cloud did not change with the viewpoint"
    page.get_by_test_id("restore-guide").click()
    page.emulate_media(reduced_motion="no-preference")
    guide_control(page, 'zoom-in').click()
    settled(page)
    deeper = capture(page, "nebula-deeper", output, evidence)
    assert deeper["insideNebula"] and deeper["distance"] < inside["distance"]
    save_observation(page, "nebula-inside", output, evidence, Image, ImageStat)
    page.get_by_test_id("scale-Surface").click()
    for name, delay in (("nebula-withdraw-layers", 180), ("nebula-withdraw-whole", 600)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    outside = settled(page)
    assert not outside["insideNebula"] and outside["observedId"] == arrived["observedId"]
    capture(page, "nebula-withdrawn", output, evidence)
    evidence["cloudEntry"] = {"startMs": entry_start, "endMs": timeline(evidence, "cloud-entry-end")}
    guide_control(page, 'next-observation').press("Enter")
    for name, delay in (("nebula-leaving-cloud", 500), ("nebula-to-sun-crossing", 1150), ("nebula-to-sun-approach", 1550)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    assert settled(page)["observed"] == "Sol"
    page.goto(configured_url(base, lang="zh", target="NGC-1976"), wait_until="networkidle")
    wait_ready(page, errors)
    assert state(page)["active"] == "Orion Nebula"
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("star-search").fill("M 42")
    assert page.get_by_test_id("destination-orion").is_visible()
    page.get_by_test_id("star-search").fill("猎户座")
    page.get_by_test_id("destination-orion").press("Enter")
    settled(page)
    capture(page, "nebula-zh-narrow", output, evidence)
    guide_control(page, 'zoom-in').press("Enter")
    assert settled(page)["insideNebula"]
    capture(page, "nebula-zh-narrow-inside", output, evidence)
    page.get_by_test_id("return-overview").click()
    for name, delay in (("nebula-return-cloud", 180), ("nebula-return-region", 500), ("nebula-return-map", 700)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    returned = settled(page)
    assert returned["activeId"] == returned["observedId"] == arrived["activeId"]
    assert returned["scaleStage"] == "Galactic" and not returned["insideNebula"]
    page.close()
    evidence.update(status="passed", errors=errors, orbitPixelDifference=difference, reducedPixelDifference=freeze_difference,
                    enteredAndWithdrawn=True, mixedTransferStopped=True, reducedMotion=True,
                    narrowAndChinese=True, aliases=True, returnedWithIdentity=True)
    assert not errors, errors


def run_moons(browser, url, output, report, Image, ImageChops, ImageStat):
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["moonJourney"] = evidence
    errors = []
    options = {"viewport": {"width": 1400, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=output / "moon-video", record_video_size=options["viewport"])
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, seed=728281, budget=report["qualityProfile"], lang="en", target="Earth")
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").click()
    earth = settled(page)
    guide_section(page, 'related')
    relation = page.get_by_test_id("body-relations")
    assert relation.locator('button[data-target="Moon"]:visible').is_visible()
    capture(page, "moon-journey-earth", output, evidence)
    guide_section(page, 'related')
    relation.locator('button[data-target="Moon"]:visible').press("Enter")
    page.wait_for_timeout(300)
    leaving = capture(page, "moon-departure-earth", output, evidence)
    assert leaving["active"] == "Moon" and leaving["observed"] == "Earth"
    page.get_by_test_id("star-map").press("Escape")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    stopped = capture(page, "moon-transfer-stopped", output, evidence)
    assert stopped["active"] == "Moon" and stopped["observed"] == "Earth"
    page.get_by_test_id("approach-target").press("Enter")
    for name, delay in (("moon-departure-resumed", 600), ("moon-crossing", 1050), ("moon-approach", 1400)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    arrived = settled(page)
    assert arrived["activeKind"] == arrived["observedKind"] == "moon"
    assert arrived["relations"]["parent"]["id"] == earth["activeId"]
    validate_state(arrived)
    parent = next(target for target in arrived["visibleTargets"] if target["id"] == earth["activeId"])
    assert parent["radius"] > 3 and 0 < parent["x"] < 1400 and 0 < parent["y"] < 900
    capture(page, "moon-arrived-with-earth", output, evidence)
    toggle_reading(page)
    assert page.get_by_test_id("target-details").get_by_role("link").get_attribute("href") == "https://science.nasa.gov/moon/facts/"
    page.get_by_test_id("hide-guide").click()
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(400)
    frozen = state(page)
    first = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    page.wait_for_timeout(500)
    second = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    box = (420, 150, 1100, 680)
    freeze_difference = ImageStat.Stat(ImageChops.difference(first.crop(box), second.crop(box))).mean
    assert max(freeze_difference) < 0.05
    assert state(page)["animationTime"] == frozen["animationTime"]
    page.get_by_test_id("star-map").focus()
    for _ in range(5):
        page.get_by_test_id("star-map").press("ArrowRight")
    page.wait_for_timeout(300)
    orbited = capture(page, "moon-orbit-relief", output, evidence)
    assert orbited["observedId"] == arrived["observedId"]
    after = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    difference = ImageStat.Stat(ImageChops.difference(second.crop(box), after.crop(box))).mean
    assert max(difference) > 0.5
    page.get_by_test_id("restore-guide").click()
    guide_control(page, 'zoom-in').click()
    assert settled(page)["distance"] < arrived["distance"]
    capture(page, "moon-surface-closer", output, evidence)
    save_observation(page, "moon-close", output, evidence, Image, ImageStat)
    # Orbiting can hide Earth behind the Moon; restore the arrival angle and
    # distance through ordinary input before selecting the visible parent.
    page.get_by_test_id("star-map").focus()
    for _ in range(5):
        page.get_by_test_id("star-map").press("ArrowLeft")
    page.get_by_test_id("scale-Surface").click()
    settled(page)
    capture(page, "moon-parent-visible-again", output, evidence)
    page.get_by_test_id("hide-guide").click()
    current = full_observation(page)
    parent = next(target for target in current["visibleTargets"] if target["id"] == earth["activeId"])
    page.mouse.move(parent["x"], parent["y"])
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId === id", arg=earth["activeId"])
    page.mouse.click(parent["x"], parent["y"])
    assert settled(page)["observedId"] == earth["activeId"]
    capture(page, "moon-parent-picked-earth", output, evidence)
    page.get_by_test_id("restore-guide").click()
    guide_section(page, 'related')
    relation.locator('button[data-target="Moon"]:visible').click()
    assert settled(page)["observedId"] == arrived["activeId"]
    page.emulate_media(reduced_motion="no-preference")
    page.goto(configured_url(base, lang="zh", target="Luna"), wait_until="networkidle")
    wait_ready(page, errors)
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("star-search").fill("月球")
    page.get_by_test_id("destination-moon").press("Enter")
    narrow = settled(page)
    assert narrow["activeId"] == arrived["activeId"]
    guide_section(page, 'related')
    assert relation.locator('button[data-target="Earth"]:visible').is_visible()
    assert any(target["id"] == earth["activeId"] for target in narrow["visibleTargets"])
    capture(page, "moon-zh-narrow", output, evidence)
    save_observation(page, "moon-narrow", output, evidence, Image, ImageStat, pause_ms=300)
    page.get_by_test_id("return-overview").click()
    for name, delay in (("moon-return-near", 180), ("moon-return-system", 500), ("moon-return-map", 650)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    returned = settled(page)
    assert returned["activeId"] == returned["observedId"] == arrived["activeId"]
    assert returned["scaleStage"] == "Galactic"
    run_outer_moons(page, base, output, evidence, Image, ImageStat)
    page.close()
    evidence.update(status="passed", errors=errors, parentPicked=True, relationsNavigable=True,
                    reducedPixelDifference=freeze_difference, orbitPixelDifference=difference,
                    transferStopped=True, narrowAndChinese=True, returnedWithIdentity=True)
    assert not errors, errors


def run_outer_moons(page, base, output, evidence, Image, ImageStat, selected_targets=None):
    """New destinations keep discovery, local family, close view and export connected."""
    moons = [("Io", "木卫一", 50014, "Jupiter", 50007),
             ("Europa", "木卫二", 50015, "Jupiter", 50007),
             ("Enceladus", "土卫二", 50016, "Saturn", 50001),
             ("Titan", "土卫六", 50017, "Saturn", 50001),
             ("Ganymede", "木卫三", 50018, "Jupiter", 50007),
             ("Callisto", "木卫四", 50019, "Jupiter", 50007),
             ("Triton", "海卫一", 50020, "Neptune", 50013),
             ("Mimas", "土卫一", 50021, "Saturn", 50001)]
    page.set_viewport_size({"width": 1280, "height": 720})
    page.emulate_media(reduced_motion="reduce")
    reviewed, exports = [], []
    for language in ("en", "zh"):
        page.goto(configured_url(base, lang=language, target="Sol"), wait_until="networkidle")
        wait_ready(page, [])
        for name, translated, identity, parent, parent_id in moons:
            if selected_targets is not None and name not in selected_targets:
                continue
            reviewed.append(name)
            page.get_by_test_id("star-map").press("/")
            page.get_by_test_id("star-search").fill(name if language == "en" else translated)
            page.get_by_test_id("destination-" + name.lower()).press("Enter")
            page.wait_for_function("id => {const s=window.__universeObservatoryState;return s?.activeId===id && s?.observedId===id && !s.flight;}", arg=identity)
            arrived = settled(page)
            assert arrived["observedId"] == arrived["activeId"] == identity, (name, arrived["activeId"], arrived["observedId"])
            assert arrived["relations"]["parent"]["id"] == parent_id
            page.get_by_test_id("scale-slider").press("End")
            close = settled(page)
            for field in ("activeId", "observedId", "cameraYaw", "cameraPitch", "cameraRoll", "fov", "animationTime"):
                assert close[field] == arrived[field], (name, field)
            assert close["distance"] < arrived["distance"]
            capture(page, f"outer-{language}-{name.lower()}-close", output, evidence)
            if (language, name) in (("en", "Europa"), ("zh", "Titan"), ("en", "Ganymede"), ("zh", "Enceladus"), ("en", "Triton"), ("zh", "Mimas")):
                save_observation(page, f"outer-{language}-{name.lower()}", output, evidence, Image, ImageStat, pause_ms=100)
                exports.append(name + "/" + language)
            guide_section(page, 'related')
            page.get_by_test_id("body-relations").locator('button[data-target="' + parent + '"]:visible').press("Enter")
            page.wait_for_function("id => {const s=window.__universeObservatoryState;return s?.observedId===id && !s.flight;}", arg=parent_id)
            assert settled(page)["observedId"] == parent_id
            guide_control(page, 'guide-local-system').press("Enter")
            page.wait_for_function("id => {const s=window.__universeObservatoryState;return s?.systemView?.rootId===id && !s.flight;}", arg=parent_id)
            family = settled(page)
            assert family["systemView"]["rootId"] == parent_id
            siblings = {row[2] for row in moons if row[4] == parent_id}
            assert siblings | {parent_id} <= set(family["systemView"]["memberIds"])
    page.get_by_test_id("return-overview").click()
    assert settled(page)["scaleStage"] == "Galactic"
    evidence["outerMoons"] = {"status": "passed", "targets": list(dict.fromkeys(reviewed)), "bilingual": True, "localFamily": True, "parentReturn": True, "exports": exports}


def run_context(browser, url, output, report, Image, ImageChops, ImageStat):
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["contextJourney"] = evidence
    errors = []
    options = {"viewport": {"width": 1280, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=output / "context-video", record_video_size={"width": 1400, "height": 900})
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, lang="en", seed=728281, target="M31", budget=report["qualityProfile"])
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    scene = page.get_by_test_id("star-map")
    context = page.get_by_test_id("space-context")

    def scientific_context(target, region, reference=False):
        guide_section(page, "read")
        assert context.is_visible()
        assert context.get_attribute("data-target") == target
        assert context.get_attribute("data-region") == region
        assert page.get_by_test_id("space-path").inner_text().strip()
        source = page.get_by_test_id("space-source")
        assert source.get_attribute("href").startswith("https://")
        assert source.get_attribute("aria-label")
        if reference:
            assert page.get_by_test_id("space-reference").is_visible()
            assert page.get_by_test_id("space-reference").inner_text().strip()

    def source_reachable():
        source = page.get_by_test_id("space-source")
        source.focus()
        box = source.bounding_box()
        guide = page.get_by_test_id("target-guide").bounding_box()
        assert source.evaluate("element => element === document.activeElement")
        assert guide["y"] <= box["y"] and box["y"] + box["height"] <= guide["y"] + guide["height"] + 1

    scientific_context("Andromeda Galaxy", "outside-milky-way", True)
    for width, height in ((320, 568), (844, 390)):
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(450)
        action = guide_control(page, "approach-target").bounding_box()
        guide = page.get_by_test_id("target-guide").bounding_box()
        assert action and guide
        assert action["y"] >= guide["y"] and action["y"] + action["height"] <= min(height, guide["y"] + guide["height"]) + 1, "first departure is clipped"
        assert action["x"] >= 0 and action["x"] + action["width"] <= width
        capture(page, f"context-first-departure-{width}", output, evidence)
    evidence["firstDepartureVisible"] = True
    page.set_viewport_size({"width": 1280, "height": 900})
    page.wait_for_timeout(450)
    capture(page, "context-star-map", output, evidence)
    guide_control(page, "approach-target").press("Enter")
    for name, delay in (("context-galaxy-crossing", 600), ("context-galaxy-approaching", 700)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    galaxy = settled(page)
    scientific_context("Andromeda Galaxy", "outside-milky-way", True)
    whole_galaxy = page.get_by_test_id("scale-LocalSystem").get_attribute("data-label")
    page.get_by_test_id("scale-LocalSystem").press("Enter")
    whole = settled(page)
    assert whole["scaleStage"] == "LocalSystem" and whole["activeId"] == galaxy["activeId"]
    assert page.get_by_test_id("scale-slider").get_attribute("aria-valuetext") == whole_galaxy
    assert whole_galaxy in page.get_by_test_id("observation-context").inner_text()
    capture(page, "context-whole-galaxy", output, evidence)
    page.get_by_test_id("scale-Surface").press("Enter")
    settled(page)

    # During departure the guide describes the destination, while scale and PNG
    # still describe the actual observed galaxy.
    guide_control(page, 'next-observation').press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    page.get_by_test_id("stop-flight").press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    held = state(page)
    assert held["observedId"] == galaxy["activeId"] and held["active"] == "Orion Nebula"
    scientific_context("Orion Nebula", "milky-way", True)
    assert page.get_by_test_id("scale-LocalSystem").get_attribute("data-label") == whole_galaxy
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(450)
    source_reachable()
    capture(page, "context-galaxy-stopped-narrow", output, evidence)
    saved = save_observation(page, "context-galaxy-departure", output, evidence, Image, ImageStat)
    assert saved["observed"] == "Andromeda Galaxy" and saved["active"] == "Orion Nebula"
    assert page.get_by_test_id("observation-image").get_attribute("data-space-region") == "outside-milky-way"
    evidence["captureUsesObservedContext"] = True

    pose = state(page)
    page.get_by_test_id("hide-guide").press("Enter")
    assert not context.is_visible()
    assert page.get_by_test_id("restore-guide").is_visible()
    page.get_by_test_id("restore-guide").press("Enter")
    scientific_context("Orion Nebula", "milky-way", True)
    for field in ("observedId", "activeId", "distance", "cameraYaw", "cameraPitch"):
        assert state(page)[field] == pose[field], f"reading changed {field}"
    page.get_by_test_id("resume-flight").press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'crossing'")
    capture(page, "context-nebula-crossing", output, evidence)
    nebula = settled(page)
    scientific_context("Orion Nebula", "milky-way", True)
    assert nebula["observed"] == "Orion Nebula"
    assert page.get_by_test_id("scale-LocalSystem").get_attribute("data-label") != whole_galaxy
    source_reachable()
    capture(page, "context-nebula-narrow", output, evidence)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.wait_for_timeout(450)
    capture(page, "context-nebula-arrived", output, evidence)
    guide_control(page, 'next-observation').press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    capture(page, "context-to-sun-departing", output, evidence)
    sun = settled(page)
    scientific_context("Sol", "solar-system")
    assert sun["observed"] == "Sol"
    capture(page, "context-solar-system", output, evidence)
    guide_section(page, 'related')
    page.locator('[data-testid="related-body"][data-target="Earth"]').press("Enter")
    earth = settled(page)
    scientific_context("Earth", "solar-system")
    assert earth["observed"] == "Earth"
    capture(page, "context-earth", output, evidence)
    guide_section(page, 'related')
    page.locator('[data-testid="related-body"][data-target="Moon"]').press("Enter")
    moon = settled(page)
    scientific_context("Moon", "solar-system")
    assert moon["observed"] == "Moon"
    capture(page, "context-moon", output, evidence)
    page.get_by_test_id("open-destinations").press("Enter")
    page.get_by_test_id("browse-comet").press("Enter")
    page.get_by_test_id("destination-halley").press("Enter")
    comet = settled(page)
    scientific_context("Halley's Comet", "solar-system")
    assert comet["observedKind"] == "comet"
    assert page.get_by_test_id("scale-LocalSystem").get_attribute("data-label") != whole_galaxy
    capture(page, "context-comet", output, evidence)
    page.set_viewport_size({"width": 844, "height": 390})
    page.wait_for_timeout(450)
    source_reachable()
    capture(page, "context-landscape-source", output, evidence)
    page.get_by_test_id("hide-guide").press("Enter")
    page.get_by_test_id("return-overview").press("Enter")
    returned = settled(page)
    assert returned["scaleStage"] == "Galactic" and returned["activeId"] == comet["activeId"]
    capture(page, "context-return-map", output, evidence)

    # Missing science context stays missing even in a larger catalog; language
    # changes do not turn generated coordinates into scientific information.
    page.goto(configured_url(base, lang="zh", target=49999, catalog=50000), wait_until="networkidle")
    wait_ready(page, errors)
    assert not context.is_visible()
    assert not page.get_by_test_id("space-source").get_attribute("href")
    capture(page, "context-generated", output, evidence)
    page.goto(configured_url(base, lang="zh", target="M31"), wait_until="networkidle")
    wait_ready(page, errors)
    scientific_context("Andromeda Galaxy", "outside-milky-way", True)
    source_reachable()
    capture(page, "context-chinese-source", output, evidence)
    assert not errors, errors
    evidence.update(status="passed", errors=errors, sourcedMembership=True, observedScaleDuringTransfer=True,
                    keyboardSource=True, sixBodyKinds=True, unsourcedOmitted=True, readingAndReturn=True)
    page.close()


def run_reading(browser, url, output, report, Image, ImageChops, ImageStat):
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["readingJourney"] = evidence
    errors = []
    options = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=output / "reading-video", record_video_size={"width": 1400, "height": 1000})
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, seed=728281, budget=report["qualityProfile"], lang="zh", target="Luna")
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    capture(page, "reading-first-entry", output, evidence)
    page.get_by_test_id("approach-target").press("Enter")
    for name, delay in (("reading-crossing", 450), ("reading-local", 800), ("reading-approaching", 700)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    settled(page)
    page.get_by_test_id("star-map").press("Escape")
    page.wait_for_timeout(450)

    def unobscured(solid=True):
        current = state(page)
        guide = page.get_by_test_id("target-guide").bounding_box()
        scene = page.get_by_test_id("star-map").bounding_box()
        local = current.get("surfaceInspection", {}).get("supported") and current["surfaceInspection"]["close"]
        fit_globe = solid and not local
        radius = current.get("bodyExtentPx", current["starRadiusPx"]) if fit_globe else 0
        assert (current["observedX"] + radius < guide["x"] or
                current["observedX"] - radius > guide["x"] + guide["width"] or
                current["observedY"] + radius < guide["y"] or
                current["observedY"] - radius > guide["y"] + guide["height"]), "reading card covers the body"
        area = current["observationArea"]
        assert area["x"] <= current["observedX"] <= area["x"] + area["width"]
        assert area["y"] <= current["observedY"] <= area["y"] + area["height"]
        if fit_globe:
            assert current["observedY"] - radius > 60, "body is hidden by the top controls"
            assert current["observedX"] - radius >= area["x"] - 1
            assert current["observedX"] + radius <= area["x"] + area["width"] + 1
            assert current["observedY"] - radius >= area["y"] - 1
            assert current["observedY"] + radius <= area["y"] + area["height"] + 1
        validate_state(current)
        return current

    moon = unobscured()
    capture(page, "reading-moon-arrived", output, evidence)
    toggle_reading(page)
    page.wait_for_timeout(600)
    unobscured()
    source = page.get_by_test_id("target-details").get_by_role("link")
    source.focus()
    source_box = source.bounding_box()
    card = page.get_by_test_id("target-guide").bounding_box()
    assert card["y"] <= source_box["y"] and source_box["y"] + source_box["height"] <= card["y"] + card["height"] + 1
    assert source.get_attribute("href") == "https://science.nasa.gov/moon/facts/"
    capture(page, "reading-source-visible", output, evidence)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(250)
    slider = page.get_by_test_id("scale-slider")
    slider.focus()
    slider.press("End")
    settled(page)
    page.get_by_test_id("star-map").press("Escape")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    page.wait_for_timeout(250)
    unobscured()
    capture(page, "reading-moon-closest", output, evidence)
    evidence["mappedSurfaceRecovery"] = mapped_surface_recovery(page)
    before = state(page)
    page.get_by_test_id("hide-guide").press("Enter")
    page.wait_for_timeout(250)
    hidden = state(page)
    for key in ("activeId", "observedId", "distance", "cameraYaw", "cameraPitch"):
        assert hidden[key] == before[key], f"hiding information changed {key}"
    scene = page.get_by_test_id("star-map").bounding_box()
    assert abs(hidden["observedY"] - scene["height"] / 2) < 1
    capture(page, "reading-full-observation", output, evidence)
    page.get_by_test_id("restore-guide").press("Enter")
    page.wait_for_timeout(250)
    current = unobscured()
    for key in ("activeId", "observedId", "distance", "cameraYaw", "cameraPitch"):
        assert current[key] == before[key], f"restoring information changed {key}"
    first, _ = surface_sample(page, current, Image)
    page.wait_for_timeout(400)
    second, _ = surface_sample(page, state(page), Image)
    freeze_difference = ImageStat.Stat(ImageChops.difference(first, second)).mean
    assert max(freeze_difference) < 0.05
    save_observation(page, "reading-moon", output, evidence, Image, ImageStat, pause_ms=300)
    page.set_viewport_size({"width": 844, "height": 390})
    page.wait_for_timeout(500)
    unobscured()
    capture(page, "reading-landscape", output, evidence)
    page.get_by_test_id("scale-Surface").press("Enter")
    settled(page)
    page.get_by_test_id("hide-guide").press("Enter")
    page.wait_for_timeout(250)
    parent = next(target for target in state(page)["visibleTargets"] if target["id"] == moon["relations"]["parent"]["id"])
    page.mouse.move(parent["x"], parent["y"])
    page.wait_for_function("id => window.__universeObservatoryState?.hoveredId === id", arg=parent["id"])
    page.mouse.click(parent["x"], parent["y"])
    assert settled(page)["activeId"] == parent["id"]
    capture(page, "reading-parent-picked", output, evidence)
    page.get_by_test_id("restore-guide").press("Enter")
    page.set_viewport_size({"width": 390, "height": 844})
    for target, solid in (("Earth", True), ("Mars", True), ("Saturn", True), ("Orion Nebula", False), ("Sol", True)):
        page.get_by_test_id("open-destinations").click()
        page.get_by_test_id("star-search").fill(target)
        page.get_by_test_id("destinations").locator(f'button[data-target="{target}"]:visible').press("Enter")
        assert settled(page)["active"] == target
        guide_section(page, "read")
        unobscured(solid)
        capture(page, f"reading-{target.lower().replace(' ', '-')}", output, evidence)
        if solid:
            arrival = state(page)
            slider.focus()
            slider.press("End")
            settled(page)
            nearest = unobscured()
            assert math.isclose(nearest["fov"], arrival["fov"], rel_tol=1e-7, abs_tol=1e-7), "zoom implicitly changed the reading lens"
            capture(page, f"reading-{target.lower()}-closest", output, evidence)
            page.get_by_test_id("star-map").press("ArrowRight")
            page.wait_for_timeout(250)
            nearest = unobscured()
            page.mouse.move(nearest["observedX"], nearest["observedY"])
            page.wait_for_function("window.__universeObservatoryState?.hoveredId === window.__universeObservatoryState?.observedId")
            if target == "Mars":
                save_observation(page, "reading-mars-closest", output, evidence, Image, ImageStat, pause_ms=300)
                page.get_by_test_id("star-map").press("Escape")
                page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
                held = state(page)
                page.emulate_media(reduced_motion="no-preference")
                timeline(evidence, "closest-reading-hide-start")
                page.get_by_test_id("hide-guide").press("Enter")
                for name, delay in (("reading-fit-full-transition", 120), ("reading-fit-full", 600)):
                    page.wait_for_timeout(delay)
                    capture(page, name, output, evidence)
                timeline(evidence, "closest-reading-open-start")
                page.get_by_test_id("restore-guide").press("Enter")
                for name, delay in (("reading-fit-open-transition", 120), ("reading-fit-open", 650)):
                    page.wait_for_timeout(delay)
                    capture(page, name, output, evidence)
                fitted = unobscured()
                for key in ("activeId", "observedId", "distance", "cameraYaw", "cameraPitch"):
                    assert fitted[key] == held[key], f"normal reading transition changed {key}"
                timeline(evidence, "closest-reading-open-end")
                page.emulate_media(reduced_motion="reduce")
    page.get_by_test_id("return-overview").press("Enter")
    returned = settled(page)
    assert returned["active"] == "Sol" and returned["scaleStage"] == "Galactic"
    capture(page, "reading-returned", output, evidence)
    page.goto(configured_url(base, lang="en", target="Moon"), wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").press("Enter")
    assert settled(page)["active"] == "Moon"
    toggle_reading(page)
    slider.focus()
    slider.press("End")
    settled(page)
    unobscured()
    capture(page, "reading-english", output, evidence)

    page.set_viewport_size({"width": 1143, "height": 853})
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("star-search").fill("Jupiter")
    page.get_by_test_id("destinations").locator('button[data-target="Jupiter"]:visible').press("Enter")
    settled(page)
    page.wait_for_timeout(400)
    arrival = unobscured()
    slider.press("End")
    settled(page)
    closest = unobscured()
    assert closest["observed"] == "Jupiter" and closest["distance"] < arrival["distance"]
    for field in ("cameraYaw", "cameraPitch", "fov"):
        assert math.isclose(closest[field], arrival[field], abs_tol=1e-7), field
    capture(page, "reading-desktop-jupiter-closest", output, evidence)
    guide_section(page, "read")
    source = page.get_by_test_id("target-map-source")
    source.focus()
    source_box = source.bounding_box()
    card = page.get_by_test_id("target-guide").bounding_box()
    assert card["y"] <= source_box["y"] and source_box["y"] + source_box["height"] <= card["y"] + card["height"] + 1
    assert source.get_attribute("href") == "https://www.solarsystemscope.com/textures/"

    scene = page.get_by_test_id("star-map")
    scene.press("ArrowRight")
    page.wait_for_timeout(300)
    scene.press("Escape")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    held = unobscured()
    animation_before = held["animationTime"]
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("before => window.__universeObservatoryState?.animationTime > before", arg=animation_before)
    timeline(evidence, "desktop-reading-hide-start")
    page.get_by_test_id("hide-guide").press("Enter")
    for name, delay in (("reading-desktop-full-transition", 120), ("reading-desktop-full", 650)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    hidden = state(page)
    assert abs(hidden["observedX"] - 1143 / 2) < 1 and abs(hidden["observedY"] - 853 / 2) < 1
    timeline(evidence, "desktop-reading-open-start")
    page.get_by_test_id("restore-guide").press("Enter")
    for name, delay in (("reading-desktop-open-transition", 120), ("reading-desktop-open", 650)):
        page.wait_for_timeout(delay)
        capture(page, name, output, evidence)
    fitted = unobscured()
    for current in (hidden, fitted):
        for field in ("activeId", "observedId", "distance", "cameraYaw", "cameraPitch"):
            assert current[field] == held[field], f"desktop reading changed {field}"
    timeline(evidence, "desktop-reading-open-end")
    page.mouse.move(fitted["observedX"], fitted["observedY"])
    page.wait_for_function("window.__universeObservatoryState?.hoveredId === window.__universeObservatoryState?.observedId")
    fixed_lens = fitted["fov"]
    for stage in ("LocalSystem", "Surface"):
        page.get_by_test_id(f"scale-{stage}").press("Enter")
        current = settled(page)
        unobscured()
        assert math.isclose(current["fov"], fixed_lens, abs_tol=1e-7), "desktop zoom changed the reading lens"
        capture(page, f"reading-desktop-jupiter-{stage.lower()}", output, evidence)

    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(250)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("star-search").fill("Saturn")
    page.get_by_test_id("destinations").locator('button[data-target="Saturn"]:visible').press("Enter")
    settled(page)
    slider.press("End")
    settled(page)
    page.wait_for_function("window.__universeObservatoryState?.distance === window.__universeObservatoryState?.distanceTarget")
    guide_section(page, "read")
    held = unobscured()
    assert held["observed"] == "Saturn" and held["bodyExtentPx"] > held["starRadiusPx"]
    capture(page, "reading-desktop-saturn-ring-closest", output, evidence)
    save_observation(page, "reading-desktop-saturn-rings", output, evidence, Image, ImageStat, pause_ms=300)
    desktop_viewports = []
    for width, height in ((701, 844), (768, 1024), (1024, 768), (1920, 1080)):
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(400)
        current = unobscured()
        for field in ("activeId", "observedId", "distance", "cameraYaw", "cameraPitch"):
            assert current[field] == held[field], f"resizing changed {field}"
        desktop_viewports.append({"width": width, "height": height, "area": current["observationArea"]})
        capture(page, f"reading-desktop-{width}-{height}", output, evidence)
    page.set_viewport_size({"width": 1143, "height": 853})
    page.wait_for_timeout(400)
    for key in ("safe", "immersive"):
        page.get_by_test_id("open-quality").press("Enter")
        radio = page.get_by_test_id(f"quality-{key}")
        if not radio.is_checked():
            radio.check()
            page.wait_for_function("key => window.__universeObservatoryState?.quality?.key === key", arg=key)
        page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
        page.keyboard.press("Escape")
        current = unobscured()
        for field in ("activeId", "observedId", "distance", "cameraYaw", "cameraPitch"):
            assert current[field] == held[field], f"reading quality changed {field}"
        capture(page, f"reading-desktop-quality-{key}", output, evidence)
    animation_before = state(page)["animationTime"]
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("before => window.__universeObservatoryState?.animationTime > before", arg=animation_before)
    page.get_by_test_id("return-overview").press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flight")
    capture(page, "reading-desktop-returning", output, evidence)
    returned = settled(page)
    assert returned["active"] == "Saturn" and returned["scaleStage"] == "Galactic"
    capture(page, "reading-desktop-returned", output, evidence)
    page.close()
    evidence.update(status="passed", errors=errors, readableSources=True, posePreserved=True,
                    reducedPixelDifference=freeze_difference, reciprocalPicking=True,
                    portraitAndLandscape=True, bilingual=True, allBodyKinds=True,
                    closestViewUnobscured=True, ringExtentUnobscured=True, zoomLensPreserved=True,
                    mediumDesktopUnobscured=True, desktopViewports=desktop_viewports,
                    desktopMotionPosePreserved=True, desktopQualityPreserved=True)
    assert not errors, errors



def run_camera(browser, url, output, report, Image, ImageChops, ImageStat):
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["cameraJourney"] = evidence
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "camera-video"), record_video_size={"width": 1280, "height": 900})
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(configured_url(url, debug=1, lang="zh", budget=report["qualityProfile"], target="Earth"), wait_until="networkidle")
    wait_ready(page, errors)
    initial = capture(page, "camera-initial", output, evidence)
    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    page.get_by_test_id("hide-guide").press("Enter")
    full_observation(page)
    pose = capture(page, "camera-earth", output, evidence)
    identity = pose["activeId"]

    def anchored(current, yaw=None, pitch=None):
        area = current["observationArea"]
        assert current["activeId"] == current["observedId"] == identity
        assert abs(current["observedX"] - (area["x"] + area["width"] / 2)) < 2
        assert abs(current["observedY"] - (area["y"] + area["height"] / 2)) < 2
        if yaw is not None:
            assert math.isclose(current["cameraYaw"], yaw, abs_tol=1e-8)
            assert math.isclose(current["cameraPitch"], pitch, abs_tol=1e-8)

    page.wait_for_timeout(5500)
    still = capture(page, "camera-idle", output, evidence)
    anchored(still, pose["cameraYaw"], pose["cameraPitch"])
    assert still["rotationPhase"] > pose["rotationPhase"], "body life remains independent of the observation camera"
    for stage in reversed(STAGES):
        timeline(evidence, "zoom-start", stage=stage)
        page.get_by_test_id(f"scale-{stage}").press("Enter")
        for step in range(6):
            page.wait_for_timeout(160)
            anchored(state(page), pose["cameraYaw"], pose["cameraPitch"])
        current = settled(page)
        anchored(current, pose["cameraYaw"], pose["cameraPitch"])
        assert current["scaleStage"] == stage
        assert math.isclose(current["fov"], pose["fov"], abs_tol=1e-8)
        capture(page, f"camera-{stage.lower()}", output, evidence)
    scene = page.get_by_test_id("star-map")
    scene.focus()
    for _ in range(4):
        page.mouse.wheel(0, 1500)
    far = settled(page)
    assert math.isclose(far["distance"], initial["distance"], rel_tol=.008), "outer range stays at the galaxy overview"
    anchored(far)
    page.get_by_test_id("scale-Surface").press("Enter")
    settled(page)
    page.get_by_test_id("open-dynamics").click()
    page.get_by_test_id("motion-paused").check()
    page.wait_for_function("window.__universeObservatoryState?.sceneMotion?.rate === 0")
    scene.press("Escape")
    reference = capture(page, "camera-paused-near-reference", output, evidence)
    page.get_by_test_id("scale-slider").press("End")
    close = settled(page)
    anchored(close, reference["cameraYaw"], reference["cameraPitch"])
    assert close["distance"] < reference["distance"] and close["starRadiusPx"] > reference["starRadiusPx"]
    capture(page, "camera-paused-close-reference", output, evidence)
    page.mouse.wheel(0, 250)
    withdrawn = settled(page)
    capture(page, "camera-paused-withdrawn-reference", output, evidence)
    assert withdrawn["distance"] > close["distance"]
    for current in (close, withdrawn):
        anchored(current, reference["cameraYaw"], reference["cameraPitch"])
        assert current["fov"] == reference["fov"]
        assert current["animationTime"] == reference["animationTime"]
        assert current["observedPosition"] == reference["observedPosition"]
    # These continuous images provide far-field angular reference evidence.
    # A fixed public lens and frozen pose do not alone prove shader projection.
    evidence["pausedNearReferenceReview"] = {
        "captures": ["camera-paused-near-reference", "camera-paused-close-reference", "camera-paused-withdrawn-reference"],
        "fixedLensAndOrientation": True, "activityFrozen": True,
        "scope": "Review background feature positions through near dolly; visual quality is not a pixel threshold."
    }
    page.get_by_test_id("open-dynamics").click()
    page.get_by_test_id("motion-flow").check()
    scene.press("Escape")
    page.mouse.move(710, 350)
    page.mouse.down(); page.mouse.move(790, 370, steps=10); page.mouse.up()
    page.wait_for_timeout(1700)
    page.get_by_test_id("lens-in").press("Enter")
    directed = settled(page)
    assert not math.isclose(directed["cameraYaw"], pose["cameraYaw"], abs_tol=.05)
    anchored(directed)
    page.get_by_test_id("return-overview").press("Enter")
    for _ in range(8):
        page.wait_for_timeout(180)
        anchored(state(page), directed["cameraYaw"], directed["cameraPitch"])
    returned = settled(page)
    assert returned["scaleStage"] == "Galactic"
    capture(page, "camera-returned", output, evidence)
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_test_id("restore-guide").press("Enter")
    page.wait_for_timeout(450)
    page.get_by_test_id("scale-Surface").press("Enter")
    current = settled(page)
    anchored(current, directed["cameraYaw"], directed["cameraPitch"])
    capture(page, "camera-reading", output, evidence)
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(300)
    reduced = state(page)
    anchored(reduced, current["cameraYaw"], current["cameraPitch"])
    page.get_by_test_id("scale-Regional").press("Enter")
    reduced = settled(page)
    anchored(reduced, current["cameraYaw"], current["cameraPitch"])
    scene.press("Home")
    reset = settled(page)
    assert reset["activeId"] == identity and reset["scaleStage"] == "Galactic"
    capture(page, "camera-reset", output, evidence)
    page.close()
    evidence.update(status="passed", errors=errors, allScaleAnchor=True, stableZoomPose=True,
                    idleCameraFixed=True, boundedOverview=True, orbitReturnAndReset=True,
                    readingComposition=True, liveReducedMotion=True)
    assert not errors, errors


def check_view_filter(page):
    """Camera-relative discovery preserves the held view and combines filters."""
    page.wait_for_function("() => window.__universeObservatoryState?.destinationViews?.length > 0")
    page.wait_for_timeout(400)
    before = state(page)
    buttons = page.locator("button[data-destination-id]")
    all_ids = set(buttons.evaluate_all("els => els.map(e => Number(e.dataset.destinationId))"))
    expected = {view["id"] for view in before["destinationViews"]
                if view["direction"] in ("visible", "covered")} & all_ids
    page.get_by_test_id("browse-visible").press("Enter")
    page.wait_for_timeout(250)
    assert set(buttons.evaluate_all("els => els.map(e => Number(e.dataset.destinationId))")) == expected
    page.get_by_test_id("star-search").fill("zz-no-known-destination")
    assert buttons.count() == 0 and page.get_by_test_id("destination-empty").is_visible()
    page.get_by_test_id("browse-all-views").press("Enter")
    assert buttons.count() == 0, "recovering all views must retain the name query"
    page.get_by_test_id("clear-search").press("Enter")
    assert set(buttons.evaluate_all("els => els.map(e => Number(e.dataset.destinationId))")) == all_ids
    assert page.get_by_test_id("star-search").evaluate("e => e === document.activeElement")
    page.wait_for_timeout(300)
    after = state(page)
    for key in ("activeId", "observedId", "distance", "distanceTarget", "cameraYaw", "cameraPitch", "cameraRoll", "fov", "animationTime", "observationArea"):
        assert before[key] == after[key], f"Discovery changed {key}"
    return {"allIds": sorted(all_ids), "inViewIds": sorted(expected), "cameraHeld": True, "queryRecovery": True}


def check_destination_preview(page):
    """Locating bridges an existing catalog result to the held scene and back."""
    page.wait_for_function("window.__universeObservatoryState?.destinationViews?.length>0")
    anchor=state(page)
    identities=set(page.locator('button[data-destination-id]').evaluate_all('(es)=>es.map(e=>Number(e.dataset.destinationId))'))
    candidate=next(view for view in anchor['destinationViews'] if view['id'] in identities and view['direction']=='visible')
    ident=candidate['id']
    result=page.locator(f'button[data-destination-id="{ident}"]')
    target=result.get_attribute('data-target')
    locate=page.locator(f'button[data-action="destination-peek"][data-preview-id="{ident}"]')
    result.hover()
    page.wait_for_function('id=>window.__universeObservatoryState.destinationPreview?.id===id',arg=ident)
    hover=state(page)['destinationPreview']
    assert hover['direction']=='visible'
    locate.focus()
    locate.press('Enter')
    page.wait_for_function('id=>window.__universeObservatoryState.destinationPreview?.id===id && window.__universeObservatoryState.destinationPreview.visible',arg=ident)
    assert page.get_by_test_id('destination-peek').is_visible()
    assert not page.get_by_test_id('destinations').is_visible()
    peek=state(page)
    for key in ('activeId','observedId','distance','distanceTarget','cameraYaw','cameraPitch','cameraRoll','fov'):
        assert anchor[key]==peek[key],f'Locating changed {key}'
    page.keyboard.press('Escape')
    assert not page.get_by_test_id('destination-peek').is_visible()
    assert page.get_by_test_id('destinations').is_visible()
    assert locate.evaluate('e=>e===document.activeElement')
    assert result.get_attribute('data-target')==target
    offscreen=next((view for view in anchor['destinationViews'] if view['id'] in identities and view['direction'] not in ('visible','covered')),None)
    if offscreen:
        page.locator(f'button[data-destination-id="{offscreen["id"]}"]').focus()
        page.wait_for_function('id=>window.__universeObservatoryState.destinationPreview?.id===id',arg=offscreen['id'])
        assert not state(page)['destinationPreview']['visible'],'Offscreen or hidden bodies must not acquire a scene marker'
    page.get_by_test_id('star-search').focus()
    page.mouse.move(0,0)
    page.wait_for_function('!window.__universeObservatoryState.destinationPreview')
    return {'id':ident,'target':target,'hoverLocated':True,'keyboardPeek':True,'cameraHeld':True,'focusRestored':True,'offscreenSuppressed':offscreen is not None,'cleared':True}


def check_filter_return(page):
    before=state(page)
    query=page.get_by_test_id("star-search").input_value()
    ids=page.locator("button[data-destination-id]").evaluate_all("els=>els.map(e=>e.dataset.destinationId)")
    page.get_by_test_id("destination-filters-return").click()
    selected=page.locator("button[data-category][aria-pressed=true]")
    assert selected.count()==1 and selected.evaluate("e=>e===document.activeElement")
    assert selected.evaluate("e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}")
    assert page.get_by_test_id("star-search").input_value()==query
    assert page.locator("button[data-destination-id]").evaluate_all("els=>els.map(e=>e.dataset.destinationId)")==ids
    after=state(page)
    for key in ("activeId","observedId","distance","distanceTarget","cameraYaw","cameraPitch","cameraRoll","fov"):
        assert before[key]==after[key],f"Returning to filters changed {key}"
    return {"queryHeld":True,"resultsHeld":True,"cameraHeld":True,"selectedCategoryFocused":True}


def run_discovery(browser, url, output, report, Image, ImageChops, ImageStat):
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["discoveryJourney"] = evidence
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "discovery-video"), record_video_size={"width": 1280, "height": 900})
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.emulate_media(reduced_motion="reduce")
    page.goto(configured_url(url, debug=1, lang="en", target="Earth", catalog=50000,
                             budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    panel = page.get_by_test_id("destinations")
    search = page.get_by_test_id("star-search")
    scene = page.locator("#scene")
    page.get_by_test_id("open-destinations").press("Enter")
    assert page.get_by_test_id("browse-featured").get_attribute("aria-pressed") == "true"
    anchor = state(page)
    categories = {"planet": ("Earth", "Saturn", "Mars", "Jupiter"), "moon": ("Moon",), "comet": ("Halley's Comet",),
                  "star": ("Sol", "Vega"), "pulsar": ("Crab Pulsar",), "blackhole": ("Sagittarius A*",), "nebula": ("Orion Nebula",), "galaxy": ("Andromeda Galaxy",)}
    named = set()
    for category, examples in categories.items():
        control = page.get_by_test_id(f"browse-{category}")
        control.press("Enter")
        assert control.get_attribute("aria-pressed") == "true"
        assert not page.get_by_test_id("recent-views").is_visible()
        buttons = panel.locator("button[data-target]:visible")
        names = buttons.evaluate_all("buttons => buttons.map(button => button.dataset.target)")
        assert 0 < len(names) <= 64 and len(set(names)) == len(names)
        assert all(name in names for name in examples)
        assert named.isdisjoint(names)
        named.update(names)
        current = state(page)
        assert current["activeId"] == anchor["activeId"] and current["observedId"] == anchor["observedId"]
        for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll"):
            assert math.isclose(current[field], anchor[field], rel_tol=1e-10, abs_tol=1e-10), field
        capture(page, f"discover-{category}", output, evidence)

    evidence["viewFilter"] = check_view_filter(page)
    evidence["destinationPreview"] = check_destination_preview(page)

    mode_anchor = state(page)
    evidence["navigationModes"] = []
    for mode in ("routes", "system", "dynamics"):
        page.get_by_test_id("navigation-"+mode).click()
        assert not search.is_visible()
        assert page.get_by_test_id("close-destinations").evaluate("e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}")
        if mode == "routes":
            page.locator("button[data-route-plan]").first.press("Enter")
            assert page.get_by_test_id("route-plan").is_visible()
        elif mode == "system":
            assert page.get_by_test_id("system-overview").is_visible()
        else:
            assert not page.get_by_test_id("motion-paused").is_enabled()
            page.emulate_media(reduced_motion="no-preference")
            page.wait_for_function("!window.__universeObservatoryState.sceneMotion.reduced")
            page.get_by_test_id("motion-paused").check()
            page.wait_for_function("window.__universeObservatoryState.sceneMotion.mode==='paused'")
            page.get_by_test_id("motion-flow").check()
            page.wait_for_function("window.__universeObservatoryState.sceneMotion.mode==='flow'")
            page.emulate_media(reduced_motion="reduce")
            page.wait_for_function("window.__universeObservatoryState.sceneMotion.reduced")
        capture(page,"discover-navigation-"+mode,output,evidence)
        page.get_by_test_id("navigation-browse").click()
        assert search.is_visible()
        current = state(page)
        for key in ("activeId","observedId","distance","distanceTarget","cameraYaw","cameraPitch","cameraRoll","fov"):
            assert current[key] == mode_anchor[key],f"Navigation mode changed {key}"
        evidence["navigationModes"].append({"mode":mode,"browseRestored":True,"cameraHeld":True})


    page.get_by_test_id("browse-moon").press("Enter")
    search.fill("Mars")
    assert page.get_by_test_id("destination-empty").is_visible()
    assert panel.locator("button[data-target]:visible").count() == 0
    search.press("Enter")
    page.wait_for_timeout(250)
    assert state(page)["activeId"] == anchor["activeId"]
    capture(page, "discover-empty-scope", output, evidence)
    page.get_by_test_id("clear-search").press("Enter")
    assert search.input_value() == "" and search.evaluate("element => element === document.activeElement")
    assert page.get_by_test_id("destination-moon").is_visible()
    scene.focus()
    scene.press("/")
    assert page.get_by_test_id("browse-featured").get_attribute("aria-pressed") == "true"
    search.fill("M 31")
    assert page.get_by_test_id("destination-andromeda").is_visible()
    search.press("Escape")
    assert not panel.is_visible()
    assert page.get_by_test_id("open-destinations").evaluate("element => element === document.activeElement")

    # A category selection reaches the same interruptible navigation as search and picking.
    previous_time = state(page)["animationTime"]
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("previous => window.__universeObservatoryState.animationTime > previous", arg=previous_time)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-planet").click()
    page.get_by_test_id("destination-earth").click()
    assert settled(page)["active"] == "Earth"
    page.get_by_test_id("hide-guide").click()
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("destination-mars").click()
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    capture(page, "discover-mars-departing", output, evidence)
    page.get_by_test_id("stop-flight").click()
    page.wait_for_timeout(300)
    paused = state(page)
    assert paused["active"] == "Mars" and paused["observed"] == "Earth"
    assert paused["navigationState"] == "paused" and not paused["flight"]
    capture(page, "discover-mars-stopped", output, evidence)
    page.get_by_test_id("resume-flight").click()
    for index in range(3):
        page.wait_for_timeout(450)
        capture(page, f"discover-mars-resume-{index}", output, evidence)
    assert settled(page)["active"] == "Mars"
    assert not panel.is_visible() and scene.evaluate("element => element === document.activeElement")
    page.get_by_test_id("restore-guide").click()
    toggle_reading(page)
    assert page.get_by_test_id("target-source").get_attribute("href").startswith("https://science.nasa.gov/mars/")
    capture(page, "discover-mars-arrived", output, evidence)
    toggle_reading(page)

    page.get_by_test_id("open-destinations").click()
    assert page.get_by_test_id("browse-planet").get_attribute("aria-pressed") == "true"
    page.get_by_test_id("browse-moon").press("Enter")
    search.press("ArrowDown")
    assert page.get_by_test_id("destination-moon").evaluate("element => element === document.activeElement")
    page.keyboard.press("Enter")
    for index in range(3):
        page.wait_for_timeout(550)
        capture(page, f"discover-moon-flight-{index}", output, evidence)
    lunar = settled(page)
    assert lunar["active"] == "Moon" and lunar["observed"] == "Moon"
    guide_section(page, 'related')
    assert page.get_by_test_id("body-relations").locator('button[data-target="Earth"]:visible').is_visible()
    capture(page, "discover-moon-arrived", output, evidence)
    page.get_by_test_id("return-overview").click()
    for index in range(3):
        page.wait_for_timeout(400)
        capture(page, f"discover-return-{index}", output, evidence)
    returned = settled(page)
    assert returned["activeId"] == lunar["activeId"] and returned["scaleStage"] == "Galactic"

    # Small catalog, Chinese copy and a long list do not hide the category controls.
    page.set_viewport_size({"width": 390, "height": 844})
    page.emulate_media(reduced_motion="reduce")
    page.goto(configured_url(url, debug=1, lang="zh", target="Moon", catalog=1000,
                             budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    assert page.locator("html").get_attribute("lang") == "zh"
    scene.focus()
    scene.press("/")
    narrow_named = set()
    for category in categories:
        page.get_by_test_id(f"browse-{category}").click()
        narrow_named.update(panel.locator("button[data-target]:visible").evaluate_all("buttons => buttons.map(button => button.dataset.target)"))
    assert narrow_named == named
    page.get_by_test_id("browse-planet").click()
    capture(page, "discover-narrow-planets", output, evidence)
    for item in ("browse-galaxy", "destination-mars"):
        page.get_by_test_id(item).focus()
        box = page.get_by_test_id(item).bounding_box()
        assert box and box["x"] >= 0 and box["x"] + box["width"] <= 390
        assert box["y"] >= 0 and box["y"] + box["height"] <= 844
    page.get_by_test_id("browse-star").press("Enter")
    search.press("ArrowDown")
    star_count = panel.locator("button[data-target]:visible").count()
    for _ in range(star_count - 1):
        page.keyboard.press("ArrowDown")
    assert panel.locator("button[data-target]:visible").last.evaluate("element => element === document.activeElement")
    # Search and exit stay available while filters scroll with the results.
    for item in ("star-search", "close-destinations"):
        assert page.get_by_test_id(item).evaluate("e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}")
    assert panel.locator("button[data-target]:visible").last.evaluate("e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}")
    page.set_viewport_size({"width":390,"height":640})
    page.wait_for_timeout(300)
    assert panel.locator("button[data-target]:visible").last.evaluate("e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}")
    page.get_by_test_id("browse-planet").focus()
    assert page.get_by_test_id("browse-planet").evaluate("e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}")
    page.set_viewport_size({"width":390,"height":844})
    settled(page)  # Resize must reach the low-frequency Worker snapshot before comparing camera invariants.
    capture(page, "discover-narrow-stars-end", output, evidence)
    evidence["filterReturn"]=check_filter_return(page)
    page.get_by_test_id("browse-moon").click()
    search.fill("月球")
    search.press("Enter")
    assert settled(page)["activeId"] == lunar["activeId"]
    assert not panel.is_visible()
    capture(page, "discover-narrow-moon", output, evidence)
    scene.focus()
    scene.press("/")
    assert page.get_by_test_id("recent-views").is_visible()
    search.press("Escape")
    assert not panel.is_visible()
    page.set_viewport_size({"width": 844, "height": 390})
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-moon").click()
    header_box = page.get_by_test_id("browse-moon").bounding_box()
    result_box = page.get_by_test_id("destination-moon").bounding_box()
    panel_box = panel.bounding_box()
    assert header_box and result_box and panel_box
    assert result_box["y"] >= header_box["y"] + header_box["height"]
    assert result_box["y"] + result_box["height"] <= panel_box["y"] + panel_box["height"]
    assert panel_box["y"] >= 0 and panel_box["y"] + panel_box["height"] <= 390
    assert page.get_by_test_id("close-destinations").evaluate("e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}")
    capture(page, "discover-landscape-moon", output, evidence)
    page.get_by_test_id("browse-pulsar").click()
    pulsar_box = page.get_by_test_id("destination-crab-pulsar").bounding_box()
    assert pulsar_box and pulsar_box["y"] + pulsar_box["height"] <= panel_box["y"] + panel_box["height"]
    capture(page, "discover-landscape-pulsar", output, evidence)
    page.get_by_test_id("browse-planet").click()
    search.press("ArrowDown")
    page.keyboard.press("ArrowDown")
    page.keyboard.press("ArrowDown")
    assert page.get_by_test_id("destination-mars").evaluate("element => element === document.activeElement")
    mars_box = page.get_by_test_id("destination-mars").bounding_box()
    assert mars_box and mars_box["y"] + mars_box["height"] <= panel_box["y"] + panel_box["height"]
    capture(page, "discover-landscape-planets", output, evidence)
    page.keyboard.press("Enter")
    assert settled(page)["active"] == "Mars"
    assert not panel.is_visible()
    page.get_by_test_id("return-overview").click()
    assert settled(page)["active"] == "Mars"
    page.close()
    evidence.update(status="passed", errors=errors, categoryCoverage=True, classificationDoesNotMoveCamera=True,
                    scopedSearchAndRecovery=True, globalShortcut=True, stopAndResume=True,
                    sourceAndReturn=True, bilingual=True, narrowKeyboardAndStickyControls=True, landscapeSelectionAndReturn=True,
                    catalogIndependentDestinationCount=len(named), namedStarCount=star_count)
    assert not errors, errors


def run_scale_navigation(browser, url, output, report):
    """Readable, directly reachable stages and a continuous independent scale control."""
    evidence = {"captures": [], "events": [], "timelineOrigin": time.monotonic()}
    report["scaleNavigationJourney"] = evidence
    options = {"viewport": {"width": 1440, "height": 900}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "scale-video"), record_video_size={"width": 1440, "height": 900})
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    if page.video:
        evidence["video"] = str(page.video.path())

    def visit(name, category):
        page.get_by_test_id("open-destinations").click()
        page.get_by_test_id(f"browse-{category}").click()
        page.get_by_test_id("star-search").fill(name)
        page.get_by_test_id("destinations").locator(f'button[data-target={json.dumps(name)}]:visible').click()
        page.wait_for_timeout(300)
        page.wait_for_function("""name => {
          const s=window.__universeObservatoryState;
          return s.active===name && s.observed===name && !s.flight && s.distance===s.distanceTarget;
        }""", arg=name)
        return state(page)

    def readable_controls():
        boxes = []
        for stage in reversed(STAGES):
            control = page.get_by_test_id(f"scale-{stage}")
            assert control.is_visible() and control.get_attribute("aria-label")
            box = control.bounding_box()
            assert box and box["x"] >= 0 and box["x"] + box["width"] <= page.viewport_size["width"]
            assert box["y"] >= 0 and box["y"] + box["height"] <= page.viewport_size["height"]
            if boxes:
                axis, extent = ("x", "width") if page.get_by_test_id("scale-slider").get_attribute("aria-orientation") == "horizontal" else ("y", "height")
                assert boxes[-1][axis] + boxes[-1][extent] <= box[axis] + .01, "scale choices overlap"
            centre = {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
            assert control.evaluate("(button,p)=>button.contains(document.elementFromPoint(p.x,p.y))", centre), "scale choice is covered"
            boxes.append(box)
        assert page.get_by_test_id("scale-slider").is_visible()
        return boxes

    def same_view(snapshot, original):
        for key in ("activeId", "observedId", "cameraYaw", "cameraPitch", "cameraRoll", "fov"):
            assert snapshot[key] == original[key], f"scale navigation changed {key}"

    try:
        page.goto(configured_url(url, debug=1, lang="en", catalog=50000, budget=report["qualityProfile"]))
        wait_ready(page, errors)
        page.add_style_tag(content="#debug{display:none!important}")
        evidence["adapter"] = state(page)["adapter"]
        assert not evidence["adapter"]["fallback"]
        original = visit("Hoag's Object", "galaxy")
        readable_controls()
        capture(page, "scale-desktop-whole", output, evidence)
        timeline(evidence, "five-stages-start")
        for stage in STAGES:
            page.get_by_test_id(f"scale-{stage}").click()
            reached = settled(page)
            assert reached["scaleStage"] == stage
            same_view(reached, original)
            assert page.get_by_test_id(f"scale-{stage}").get_attribute("aria-current") == "true"
            capture(page, f"scale-desktop-{stage}", output, evidence)
        timeline(evidence, "five-stages-end")
        slider = page.get_by_test_id("scale-slider")
        slider.press("Home"); outer = settled(page)
        slider.press("End"); inner = settled(page)
        assert outer["scaleAxisProgress"] < 0.001 and inner["scaleAxisProgress"] > 0.999
        same_view(inner, original)
        slider.press("ArrowDown"); backed = settled(page)
        assert backed["distance"] > inner["distance"]
        capture(page, "scale-endpoint-keyboard", output, evidence)
        page.get_by_test_id("scale-Galactic").click()
        page.get_by_test_id("stop-flight").wait_for(state="visible", timeout=2000)
        page.wait_for_function("()=>window.__universeObservatoryState.navigationState==='zooming'")
        capture(page, "scale-moving-destination", output, evidence)
        page.get_by_test_id("stop-flight").click(); page.wait_for_timeout(350)
        paused = state(page)
        assert paused["navigationState"] == "paused"
        page.wait_for_timeout(400)
        assert state(page)["distance"] == paused["distance"]
        capture(page, "scale-stopped", output, evidence)
        # Stopped scale changes restart by selecting a visible scale. The Continue
        # action belongs to destination flights, rather than changing this contract.
        page.get_by_test_id("scale-Galactic").click(); resumed = settled(page)
        assert resumed["scaleStage"] == "Galactic"
        same_view(resumed, original)
        scrub_center = scrub_scale(page, .7, .3)
        dragged = settled(page)
        assert .55 < dragged["scaleAxisProgress"] < .85
        same_view(dragged, original)
        capture(page, "scale-pointer-scrub", output, evidence)
        page.mouse.move(*scrub_center); page.mouse.wheel(0, 200)
        wheeled = settled(page)
        assert wheeled["distance"] > dragged["distance"]
        same_view(wheeled, original)
        page.get_by_test_id("scale-Surface").focus()
        for stage in ("LocalSystem", "LocalMap", "Regional", "Galactic", "slider"):
            page.keyboard.press("Tab")
            assert page.get_by_test_id(f"scale-{stage}").evaluate("e=>document.activeElement===e")
        page.get_by_test_id("return-overview").click(); returned = settled(page)
        assert returned["scaleStage"] == "Galactic" and returned["activeId"] == original["activeId"]
        capture(page, "scale-return-map", output, evidence)
        page.emulate_media(reduced_motion="reduce")
        names = []
        for name, kind in [("Sol", "star"), ("Earth", "planet"), ("Crab Pulsar", "pulsar"), ("Sagittarius A*", "blackhole"), ("Orion Nebula", "nebula"), ("Hoag's Object", "galaxy")]:
            reached = visit(name, kind)
            assert reached["observedKind"] == kind
            readable_controls()
            names.append(page.get_by_test_id("scale-LocalSystem").get_attribute("aria-label"))
            capture(page, f"scale-kind-{kind}", output, evidence)
        assert len(set(names)) == 5, "extended bodies must retain meaningful scale names"
        for lang,w,h in [("en",390,844),("zh",390,844),("en",844,390),("zh",320,568)]:
            page.set_viewport_size({"width":w,"height":h})
            page.goto(configured_url(url, debug=1, lang=lang, catalog=50000, budget=report["qualityProfile"]))
            wait_ready(page, errors);page.add_style_tag(content="#debug{display:none!important}")
            whole = visit("Hoag's Object", "galaxy");readable_controls()
            assert whole["observationArea"]["height"] >= h * .15, "reading leaves no meaningful independent observation space"
            capture(page, f"scale-{lang}-{w}x{h}-whole", output, evidence)
            for stage in STAGES:
                page.get_by_test_id(f"scale-{stage}").press("Enter")
                reached=settled(page)
                assert reached["scaleStage"] == stage and reached["observed"] == "Hoag's Object"
            page.get_by_test_id("hide-guide").click();readable_controls()
            capture(page, f"scale-{lang}-{w}x{h}-clear", output, evidence)
        assert not errors, errors
        evidence.update(status="passed", fiveStages=True, endpoints=True, keyboardOrder=True,
                        pointerAndWheel=True, stopAndRestartScale=True, fixedViewAndIdentity=True,
                        sixKinds=True, bilingualResponsive=True, reducedMotion=True)
    finally:
        evidence["errors"]=errors
        page.close()


def check_compact_named_reading(page, url, quality, output, evidence):
    """A long current name must leave actual scrollable reading on a short screen."""
    page.emulate_media(reduced_motion="reduce")
    page.set_viewport_size({"width": 320, "height": 568})
    page.goto(configured_url(url, debug=1, lang="en", target="Whirlpool Galaxy", budget=quality), wait_until="networkidle")
    wait_ready(page, [])
    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    toggle_reading(page)
    source = page.get_by_test_id("target-source")
    source.scroll_into_view_if_needed()
    source.focus()
    bounds = source.bounding_box()
    reading_area = page.get_by_test_id("body-reading").bounding_box()
    assert bounds and reading_area and reading_area["y"] <= bounds["y"]
    assert bounds["y"] + bounds["height"] <= reading_area["y"] + reading_area["height"] + 1
    assert source.evaluate("e => { const r=e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }")
    before = state(page)
    page.get_by_test_id("body-reading").press("End")
    page.wait_for_timeout(300)
    after = state(page)
    for key in ("activeId", "observedId", "distance", "distanceTarget", "cameraYaw", "cameraPitch", "cameraRoll", "fov", "observationArea"):
        assert before[key] == after[key], f"Reading changed {key}"
    capture(page, "feedback-short-long-name-reading", output, evidence)
    return {"sourceVisibleInsideReading": True, "scrollKeepsView": True, "observationArea": after["observationArea"]}


def run_feedback(browser, url, output, report, Image, ImageChops, ImageStat):
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["feedbackJourney"] = evidence
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "feedback-video"), record_video_size={"width": 1280, "height": 900})
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.emulate_media(reduced_motion="reduce")
    page.goto(configured_url(url, debug=1, lang="en", target="Sol", budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    scene = page.get_by_test_id("star-map")
    location = page.get_by_test_id("position-readout")
    navigation = page.get_by_test_id("navigation-feedback")
    operation = page.get_by_test_id("operation-feedback")

    def display_name():
        return page.get_by_test_id("target-guide").get_by_role("heading", level=1, include_hidden=True).text_content().strip()

    def identities(observed_name, target_name=None):
        snapshot = state(page)
        assert scene.get_attribute("data-observed-id") == str(snapshot["observedId"])
        assert scene.get_attribute("data-active-id") == str(snapshot["activeId"])
        assert observed_name in location.inner_text()
        assert observed_name in scene.get_attribute("aria-label")
        if target_name:
            assert target_name in navigation.inner_text()
            assert target_name in scene.get_attribute("aria-label")
        return snapshot

    def pose_unchanged(current, original):
        for field in ("activeId", "observedId", "distance", "distanceTarget", "cameraYaw", "cameraPitch", "cameraRoll", "fov"):
            assert current[field] == original[field], f"feedback changed {field}"

    def clear_tools():
        hud = page.get_by_test_id("observation-hud").bounding_box()
        viewport = page.viewport_size
        assert hud and hud["x"] >= 0 and hud["x"] + hud["width"] <= viewport["width"]
        # The same global navigation remains readable and directly operable
        # alongside current-observation and stopped-destination feedback.
        for control in ("space-overview", "return-overview", "open-destinations"):
            button = page.get_by_test_id(control)
            assert button.get_attribute("aria-label")
            bounds = button.bounding_box()
            assert bounds and bounds["x"] >= 0 and bounds["y"] >= 0
            assert bounds["x"] + bounds["width"] <= viewport["width"] and bounds["y"] + bounds["height"] <= viewport["height"]
            assert button.evaluate("e => { const r=e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }")
        for control in ("open-quality", "lens-in", "zoom-out", "capture-view"):
            box = page.get_by_test_id(control).bounding_box()
            assert box and box["y"] + box["height"] <= viewport["height"]
            assert hud["y"] + hud["height"] <= box["y"], "feedback obscures observation tools"

    def clear_reading():
        hud = page.get_by_test_id("observation-hud").bounding_box()
        guide = page.get_by_test_id("target-guide").bounding_box()
        assert hud and guide
        assert (hud["y"] + hud["height"] <= guide["y"] or
                hud["x"] >= guide["x"] + guide["width"] or
                hud["x"] + hud["width"] <= guide["x"]), "reading obscures observation feedback"

    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    identities(display_name())
    page.get_by_test_id("open-destinations").press("Enter")
    page.get_by_test_id("browse-moon").press("Enter")
    page.get_by_test_id("destination-moon").press("Enter")
    lunar = settled(page)
    moon_name = display_name()
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_test_id("hide-guide").press("Enter")
    scene.press("ArrowLeft")
    page.wait_for_timeout(300)
    assert operation.is_visible() and operation.inner_text().strip()
    clear_tools()
    capture(page, "feedback-keyboard", output, evidence)

    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_timeout(300)
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-planet").click()
    page.get_by_test_id("destination-mars").click()
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    page.get_by_test_id("stop-flight").click()
    page.wait_for_timeout(300)
    mars_name = display_name()
    stopped = identities(moon_name, mars_name)
    assert stopped["observedId"] == lunar["activeId"] and stopped["activeId"] != lunar["activeId"]
    assert stopped["navigationState"] == "paused" and not stopped["flight"]
    assert scene.evaluate("element => element === document.activeElement")
    clear_tools()
    capture(page, "feedback-mars-stopped", output, evidence)
    page.wait_for_timeout(8000)
    held = identities(moon_name, mars_name)
    pose_unchanged(held, stopped)
    assert navigation.is_visible() and not operation.is_visible()
    clear_tools()
    capture(page, "feedback-mars-held", output, evidence)
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(300)
    orbited = identities(moon_name, mars_name)
    assert orbited["cameraYaw"] != stopped["cameraYaw"]
    assert orbited["observedId"] == stopped["observedId"] and orbited["activeId"] == stopped["activeId"]
    capture(page, "feedback-stopped-orbit", output, evidence)
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    orbited = identities(moon_name, mars_name)

    page.get_by_test_id("open-quality").press("Enter")
    quality = "standard" if state(page)["quality"]["key"] == "safe" else "safe"
    page.get_by_test_id(f"quality-{quality}").check()
    page.wait_for_function("key => window.__universeObservatoryState?.quality?.key === key", arg=quality)
    page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    pose_unchanged(identities(moon_name, mars_name), orbited)
    assert operation.is_visible() and operation.inner_text().strip()
    clear_tools()
    capture(page, "feedback-paused-quality", output, evidence)
    save_observation(page, "feedback-paused", output, evidence, Image, ImageStat)
    pose_unchanged(identities(moon_name, mars_name), orbited)

    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("browse-galaxy").click()
    page.get_by_test_id("destination-andromeda").click()
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    page.get_by_test_id("stop-flight").click()
    page.wait_for_timeout(300)
    galaxy_name = display_name()
    changed = identities(moon_name, galaxy_name)
    assert changed["activeId"] != stopped["activeId"] and changed["observedId"] == lunar["activeId"]
    capture(page, "feedback-destination-changed", output, evidence)
    page.get_by_test_id("resume-flight").press("Enter")
    seen_phases = set()
    for _ in range(100):
        page.wait_for_timeout(200)
        current = state(page)
        phase = current.get("flightPhase")
        if phase and phase not in seen_phases:
            seen_phases.add(phase)
            assert navigation.is_visible() and galaxy_name in navigation.inner_text()
            capture(page, f"feedback-galaxy-{phase}", output, evidence)
        if not current["flight"] and current["observedId"] == changed["activeId"]:
            break
    arrived = settled(page)
    assert seen_phases == {"departing", "crossing", "approaching"}
    assert arrived["observedId"] == arrived["activeId"] == changed["activeId"]
    identities(galaxy_name)
    assert not navigation.is_visible()
    capture(page, "feedback-galaxy-arrived", output, evidence)
    page.get_by_test_id("return-overview").press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'returning'")
    assert navigation.is_visible()
    capture(page, "feedback-returning", output, evidence)
    assert settled(page)["scaleStage"] == "Galactic"
    identities(galaxy_name)
    assert not navigation.is_visible()
    capture(page, "feedback-returned", output, evidence)

    # Persistent location affects reading composition; a transient message must not move it.
    page.emulate_media(reduced_motion="reduce")
    page.goto(configured_url(url, debug=1, lang="zh", target="Moon", budget=report["qualityProfile"]), wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    identities(display_name())
    page.wait_for_timeout(700)
    clear_reading()
    toggle_reading(page)
    source = page.get_by_test_id("target-source")
    source.scroll_into_view_if_needed()
    source.focus()
    bounds = source.bounding_box()
    reading_area = page.get_by_test_id("body-reading").bounding_box()
    assert bounds and reading_area and reading_area["y"] <= bounds["y"]
    assert bounds["y"] + bounds["height"] <= reading_area["y"] + reading_area["height"] + 1
    assert source.evaluate("e => { const r=e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }")
    reading = capture(page, "feedback-narrow-reading", output, evidence)
    page.wait_for_timeout(7200)
    faded = identities(display_name())
    pose_unchanged(faded, reading)
    assert faded["observationArea"] == reading["observationArea"], "fading a message reframed the body"
    assert not operation.is_visible()
    page.set_viewport_size({"width": 844, "height": 390})
    page.wait_for_timeout(300)
    clear_tools()
    clear_reading()
    identities(display_name())
    capture(page, "feedback-landscape-reading", output, evidence)
    page.set_viewport_size({"width": 320, "height": 568})
    page.get_by_test_id("hide-guide").press("Enter")
    scene.press("ArrowLeft")
    clear_tools()
    identities(display_name())
    capture(page, "feedback-small-keyboard", output, evidence)
    evidence["compactNamedReading"] = check_compact_named_reading(page, url, report["qualityProfile"], output, evidence)
    page.context.close()
    evidence.update(status="passed", errors=errors, durableStoppedState=True, stoppedKeyboardFocus=True,
                    observedAndDestinationIndependent=True, switchingAndResuming=True, returnAndClear=True,
                    qualityAndCaptureFeedback=True, bilingualNames=True, responsiveTools=True,
                    transientFeedbackDoesNotReframe=True, reducedMotion=True)
    assert not errors, errors


def run_revisit(browser, url, output, report, Image, ImageChops, ImageStat):
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["revisitJourney"] = evidence
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "revisit-video"), record_video_size={"width": 1280, "height": 900})
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    base = configured_url(url, debug=1, lang="zh", target="Mars", budget=report["qualityProfile"])
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    assert state(page)["recentViews"] == []
    panel = page.get_by_test_id("destinations")
    recent = page.get_by_test_id("recent-views")
    scene = page.locator("#scene")

    def recorded():
        page.wait_for_function("""() => {
          const s = window.__universeObservatoryState;
          return s.activeId === s.observedId && !s.flight &&
            s.distance === s.distanceTarget &&
            s.recentViews.some(view => view.id === s.activeId);
        }""")
        return state(page)

    def matching_pose(actual, expected):
        for field in ("activeId", "observedId"):
            assert actual[field] == expected[field], field
        for field in ("distance", "cameraYaw", "cameraPitch", "cameraRoll"):
            assert math.isclose(actual[field], expected[field], rel_tol=1e-8, abs_tol=1e-10), f"{field}: restored {actual[field]}, recorded {expected[field]}"

    def completed_revisit(identity, expected):
        settled(page)
        # Exact pose evidence belongs to the completed observation. The generic
        # visual wait accepts a nearby frame before navigation has finished.
        # A same-body revisit can start while the previous overview already
        # reports 'observing'. Require the recalled distance to be accepted,
        # rather than treating that stale report as the completed observation.
        page.wait_for_function("""({identity, distance}) => {
          const s = window.__universeObservatoryState;
          return s && s.activeId === identity && s.observedId === identity &&
            !s.flight && !s.revisiting && s.navigationState === 'observing' &&
            Math.abs(Math.log(s.distanceTarget / distance)) < 1e-8;
        }""", arg={"identity": identity, "distance": expected["distance"]}, timeout=20000)
        return state(page)

    def visit(target):
        page.get_by_test_id("open-destinations").press("Enter")
        page.get_by_test_id("star-search").fill(target)
        assert not recent.is_visible()
        page.get_by_test_id("star-search").press("Enter")
        assert not panel.is_visible()
        settled(page)
        return recorded()

    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    page.get_by_test_id("hide-guide").press("Enter")
    scene.press("ArrowRight")
    scene.press("ArrowUp")
    page.get_by_test_id("scale-slider").press("End")
    settled(page)
    scene.press("Escape")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    recorded()
    saved = capture(page, "revisit-mars-original", output, evidence)
    mars_id = saved["activeId"]
    page.get_by_test_id("open-destinations").press("Enter")
    assert recent.is_visible()
    search = page.get_by_test_id("star-search")
    search.press("ArrowDown")
    mars_button = page.get_by_test_id(f"revisit-{mars_id}")
    assert mars_button.evaluate("element => element === document.activeElement")
    page.wait_for_timeout(500)
    assert mars_button.evaluate("element => element === document.activeElement"), "state reports stole focus from a revisit entry"
    search.fill("地球")
    assert not recent.is_visible()
    search.press("Enter")
    settled(page)
    earth = recorded()
    assert earth["active"] == "Earth"
    scene.press("ArrowLeft")
    page.wait_for_timeout(300)
    scene.press("Escape")
    page.wait_for_timeout(250)
    earth = capture(page, "revisit-earth-observed", output, evidence)
    page.get_by_test_id("open-destinations").press("Enter")
    assert recent.get_by_role("button").count() == 2
    capture(page, "revisit-choices", output, evidence)
    timeline(evidence, "revisit-start", target="Mars")
    mars_button.press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    page.get_by_test_id("stop-flight").press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    stopped = capture(page, "revisit-stopped", output, evidence)
    assert stopped["activeId"] == mars_id and stopped["observedId"] == earth["observedId"]
    assert stopped["revisiting"]
    page.wait_for_timeout(500)
    matching_pose(state(page), stopped)
    assert page.get_by_test_id("resume-flight").is_visible()
    page.get_by_test_id("resume-flight").press("Enter")
    restored = completed_revisit(mars_id, saved)
    matching_pose(restored, saved)
    capture(page, "revisit-mars-restored", output, evidence)
    timeline(evidence, "revisit-completed", target="Mars")
    validate_state(restored)
    assert restored["catalog"] == saved["catalog"]

    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(250)
    page.get_by_test_id("return-overview").press("Enter")
    assert settled(page)["scaleStage"] == "Galactic"
    page.get_by_test_id("open-quality").press("Enter")
    page.get_by_test_id("quality-safe").check()
    page.wait_for_function("window.__universeObservatoryState?.quality?.key === 'safe'")
    page.get_by_test_id("close-quality").press("Enter")
    page.get_by_test_id("open-destinations").press("Enter")
    mars_button.press("Enter")
    restored = completed_revisit(mars_id, saved)
    capture(page, "revisit-mars-reduced-restored", output, evidence)
    matching_pose(restored, saved)
    assert not restored["flight"]
    assert restored["quality"]["key"] == "safe"
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_test_id("restore-guide").press("Enter")
    page.get_by_test_id("open-destinations").press("Enter")
    capture(page, "revisit-narrow", output, evidence)
    box = panel.bounding_box()
    assert box["x"] >= 0 and box["x"] + box["width"] <= 390
    assert box["y"] + box["height"] <= 844
    page.keyboard.press("Escape")
    assert page.get_by_test_id("open-destinations").evaluate("element => element === document.activeElement")
    page.emulate_media(reduced_motion="no-preference")
    visit("Earth")
    page.get_by_test_id("open-destinations").press("Enter")
    mars_button.press("Enter")
    page.get_by_test_id("stop-flight").click()
    page.wait_for_function("window.__universeObservatoryState?.navigationState === 'paused'")
    resume = page.get_by_test_id("resume-flight")
    box = resume.bounding_box()
    assert box["x"] >= 0 and box["x"] + box["width"] <= 390
    assert resume.get_attribute("aria-label")
    capture(page, "revisit-narrow-stopped", output, evidence)
    resume.press("Enter")
    matching_pose(completed_revisit(mars_id, saved), saved)
    page.emulate_media(reduced_motion="reduce")
    page.set_viewport_size({"width": 1280, "height": 720})
    for target in ("Earth", "Moon", "Saturn", "Orion Nebula", "Sol", "Sirius", "Betelgeuse", "Proxima Centauri", "Vega"):
        visit(target)
    bounded = state(page)
    assert len(bounded["recentViews"]) <= 8
    assert len({view["id"] for view in bounded["recentViews"]}) == len(bounded["recentViews"])
    assert not any(view["id"] == mars_id for view in bounded["recentViews"])
    page.get_by_test_id("open-destinations").press("Enter")
    assert recent.get_by_role("button").count() <= 8
    capture(page, "revisit-bounded-list", output, evidence)
    before = state(page)
    page.get_by_test_id("star-search").fill("no-body-with-this-name")
    assert page.get_by_test_id("destination-empty").is_visible()
    assert not recent.is_visible()
    page.get_by_test_id("star-search").press("Enter")
    matching_pose(state(page), before)

    page.goto(configured_url(base, lang="en", target="Moon"), wait_until="networkidle")
    wait_ready(page, errors)
    assert state(page)["recentViews"] == [], "revisit records escaped their page session"
    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    scene.press("ArrowRight")
    page.get_by_test_id("scale-slider").press("End")
    settled(page)
    scene.press("Escape")
    page.wait_for_timeout(300)
    recorded()
    moon = capture(page, "revisit-moon-original", output, evidence)
    visit("Earth")
    page.set_viewport_size({"width": 844, "height": 390})
    page.get_by_test_id("open-destinations").press("Enter")
    moon_button = page.get_by_test_id(f"revisit-{moon['activeId']}")
    assert moon_button.get_attribute("aria-label")
    box = panel.bounding_box()
    assert box["y"] + box["height"] <= 390
    capture(page, "revisit-landscape", output, evidence)
    moon_button.press("Enter")
    restored = completed_revisit(moon["activeId"], moon)
    matching_pose(restored, moon)
    capture(page, "revisit-moon-restored", output, evidence)
    page.set_viewport_size({"width": 1280, "height": 720})
    page.goto(configured_url(base, lang="en", catalog=50000, target=49999, budget="immersive"), wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    generated = recorded()
    assert generated["activeId"] == 49999
    capture(page, "revisit-generated-original", output, evidence)
    visit("Sol")
    page.get_by_test_id("open-quality").press("Enter")
    page.get_by_test_id("quality-safe").check()
    page.wait_for_function("window.__universeObservatoryState?.quality?.key === 'safe'")
    page.get_by_test_id("close-quality").press("Enter")
    page.get_by_test_id("open-destinations").press("Enter")
    page.get_by_test_id("revisit-49999").press("Enter")
    restored = completed_revisit(generated["activeId"], generated)
    matching_pose(restored, generated)
    validate_state(restored)
    assert restored["catalog"] == 50000 and restored["quality"]["key"] == "safe"
    assert restored["starRadiusPx"] > 20
    surface_sample(page, restored, Image)
    capture(page, "revisit-generated-restored", output, evidence)
    evidence.update(status="passed", errors=errors, restoredWorldPose=True, stoppedAndResumed=True,
                    reducedMotion=True, qualityPreserved=True, bilingual=True, responsive=True,
                    bounded=True, sessionOnly=True, generatedRevisit=True)
    assert not errors, errors
    page.context.close()


def run_quality(browser, url, output, report, Image, ImageChops, ImageStat, performance_probe=False):
    errors = []
    evidence = {"captures": [], "events": [], "recordVideo": report["recordVideo"], "status": "running"}
    report["qualityJourney"] = evidence
    options = {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 2}
    if report["recordVideo"]:
        options.update(record_video_dir=str(output / "quality-video"), record_video_size={"width": 1280, "height": 900})
    page = browser.new_page(**options)
    evidence["timelineOrigin"] = time.monotonic()
    if page.video:
        evidence["video"] = str(page.video.path())
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.emulate_media(reduced_motion="reduce")
    base = configured_url(url, debug=1, lang="zh", target="Earth", budget="standard")
    page.goto(base, wait_until="networkidle")
    wait_ready(page, errors)
    page.get_by_test_id("approach-target").press("Enter")
    settled(page)
    page.get_by_test_id("hide-guide").press("Enter")
    page.wait_for_timeout(300)
    initial = state(page)
    identity = initial["activeId"]

    def switch(key):
        page.get_by_test_id("open-quality").press("Enter")
        panel = page.get_by_test_id("quality-panel")
        assert panel.is_visible()
        radio = page.get_by_test_id(f"quality-{key}")
        assert radio.get_attribute("type") == "radio"
        if not radio.is_checked():
            radio.check()
            page.wait_for_function("key => window.__universeObservatoryState?.quality?.key === key", arg=key)
        page.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled")
        assert radio.is_checked()
        assert page.get_by_test_id("quality-feedback").inner_text().strip()
        page.keyboard.press("Escape")
        assert not panel.is_visible()
        assert page.get_by_test_id("open-quality").evaluate("element => element === document.activeElement")
        return settled(page)

    profiles = []
    for key in ("safe", "immersive", "standard", "safe", "immersive"):
        current = switch(key)
        assert current["activeId"] == current["observedId"] == identity
        for field in ("distance", "cameraYaw", "cameraPitch", "fov", "animationTime"):
            assert math.isclose(current[field], initial[field], rel_tol=1e-8, abs_tol=1e-8), field
        quality = current["quality"]
        assert quality["key"] == current["budget"]["key"] == key
        assert quality["width"] * quality["height"] <= quality["pixelLimit"]
        assert 0 < quality["volumeWidth"] <= quality["width"]
        assert 0 < quality["volumeHeight"] <= quality["height"]
        profiles.append(quality)
        capture(page, f"quality-earth-{key}", output, evidence)
    assert profiles[0]["earthTextureWidth"] < profiles[1]["earthTextureWidth"]
    assert profiles[0]["width"] * profiles[0]["height"] < profiles[1]["width"] * profiles[1]["height"]
    save_observation(page, "quality-earth", output, evidence, Image, ImageStat, pause_ms=300)
    page.emulate_media(reduced_motion="no-preference")
    page.get_by_test_id("open-destinations").click()
    page.get_by_test_id("destination-saturn").press("Enter")
    page.wait_for_function("window.__universeObservatoryState?.flightPhase === 'departing'")
    before = state(page)
    changed = switch("safe")
    assert changed["activeId"] == before["activeId"] and changed["active"] == "Saturn"
    assert changed["navigationState"] in ("flying", "observing")
    arrived = settled(page)
    assert arrived["observed"] == "Saturn"
    capture(page, "quality-flight-continued", output, evidence)
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_test_id("open-quality").click()
    panel = page.get_by_test_id("quality-panel")
    close = page.get_by_test_id("close-quality")
    box = close.bounding_box()
    assert 0 <= box["x"] and box["x"] + box["width"] <= 390
    assert 0 <= box["y"] and box["y"] + box["height"] <= 844
    capture(page, "quality-narrow", output, evidence)
    page.keyboard.press("Tab")
    assert panel.evaluate("element => element.contains(document.activeElement)")
    page.keyboard.press("Escape")
    page.get_by_test_id("return-overview").press("Enter")
    assert settled(page)["active"] == "Saturn"
    page.goto(configured_url(base, lang="en", budget="immersive", target="Moon"), wait_until="networkidle")
    wait_ready(page, errors)
    assert state(page)["quality"]["key"] == "immersive"
    page.get_by_test_id("open-quality").press("Enter")
    assert page.get_by_test_id("quality-panel").get_by_role("heading").inner_text().strip()
    capture(page, "quality-english", output, evidence)
    page.keyboard.press("Escape")

    # Closing a dialog must not steal focus from a subsequent keyboard action.
    # Exercise the real rapid handoff, including its delayed native close event.
    for _ in range(3):
        page.get_by_test_id("open-quality").press("Enter")
        page.get_by_test_id("close-quality").press("Enter")
        page.get_by_test_id("open-destinations").press("Enter")
        page.wait_for_timeout(200)
        assert page.get_by_test_id("destinations").is_visible()
        assert not page.get_by_test_id("quality-panel").is_visible()
        assert page.get_by_test_id("star-search").evaluate("element => element === document.activeElement")
        page.keyboard.press("Escape")
    capture(page, "quality-keyboard-dialog-exit", output, evidence)
    evidence["dialogExitPreservesNextAction"] = True

    if performance_probe:
        page.emulate_media(reduced_motion="no-preference")
        page.set_viewport_size({"width": 1920, "height": 1080})
        performance_cases = []
        for key in ("safe", "immersive"):
            switch(key)
            for target, endpoint in (("Earth", 0), ("Earth", 1), ("Sol", 1), ("Orion Nebula", 1), ("Saturn", 1), ("Moon", 1), ("Mars", 1), ("Jupiter", 2), ("Jupiter", 1), ("Andromeda Galaxy", 1), ("Halley's Comet", 2), ("Halley's Comet", 1)):
                page.get_by_test_id("open-destinations").click()
                page.get_by_test_id("star-search").fill(target)
                page.get_by_test_id("destinations").locator(f'button[data-target="{target}"]:visible').press("Enter")
                settled(page)
                if endpoint != 2:
                    slider = page.get_by_test_id("scale-slider")
                    slider.focus()
                    slider.press("End" if endpoint else "Home")
                settled(page)
                samples = []
                completed_before = (state(page).get("performance") or {}).get("completedThroughFrame", 0)
                last_completed = completed_before
                unique_gpu, unique_latency, cpu_windows = [], [], []
                timeline(evidence, "performance-start", quality=key, target=target, endpoint=endpoint)
                for _ in range(45):
                    page.wait_for_timeout(200)
                    snapshot = state(page)
                    current = snapshot.get("performance") or {}
                    samples.append({"rafMs": snapshot["frameMs"], **current})
                    completed = current.get("completedThroughFrame", 0)
                    if completed > last_completed and current.get("gpuMsLatest") is not None:
                        unique_gpu.append(current["gpuMsLatest"])
                        unique_latency.append(current["completionLatencyMsLatest"])
                        last_completed = completed
                    if current.get("cpuMsP95") is not None:
                        cpu_windows.append(current["cpuMsP95"])
                measured = state(page)
                timing = measured.get("performance") or {}
                def percentile95(values):
                    return sorted(values)[min(len(values) - 1, math.floor(len(values) * .95))] if values else None
                gpu_ms = percentile95(unique_gpu)
                cpu_ms = max(cpu_windows) if cpu_windows else None
                assert not timing.get("timestampQuery") or len(unique_gpu) >= 8, "Insufficient GPU timestamp evidence"
                item = {"quality": measured["quality"], "target": target, "stage": measured["scaleStage"],
                        "adapter": measured.get("adapter"), "timing": timing,
                        "caseTiming": {"gpuMsP95": gpu_ms, "cpuMsP95UpperBound": cpu_ms,
                                       "completionLatencyMsP95": percentile95(unique_latency), "gpuSamples": len(unique_gpu)},
                        "rafIntervalMs": measured["frameMs"], "samples": samples,
                        "gpuAndCpuWithin60HzBudget": (gpu_ms + cpu_ms <= 1000/60) if gpu_ms is not None and cpu_ms is not None else None,
                        "meaning": "Independent GPU timestamp samples after this scenario settles; conservative maximum of Worker CPU p95 windows. RAF and completion latency are supporting evidence, not OS presentation FPS."}
                performance_cases.append(item)
                capture(page, f"performance-{key}-{target.lower().replace(' ', '-')}-{endpoint}", output, evidence)
        evidence["performanceProbe"] = performance_cases
    page.close()
    evidence.update(status="passed", errors=errors, liveProfiles=True, boundedResources=True,
                    poseAndIdentityPreserved=True, flightContinued=True, narrowAndBilingual=True,
                    keyboardExit=True, sessionOnly=True)
    assert not errors, errors

def background_evidence(report, Image, ImageChops, ImageStat):
    names = [item["name"] for item in report["captures"] if item["name"].startswith("travel-")]
    pairs = list(zip(names, names[1:])) + [("idle-start", "idle-end"), ("reduced-motion-start", "reduced-motion-end")]
    captures = {item["name"]: item for item in report["captures"]}
    evidence = []
    for first_name, second_name in pairs:
        first, second = captures[first_name], captures[second_name]
        a = Image.open(first["file"]).convert("RGB")
        b = Image.open(second["file"]).convert("RGB")
        source_width, source_height = a.size
        a, b = a.resize((280, 180)), b.resize((280, 180))
        mask = Image.new("L", a.size)
        values = []
        for y in range(a.height):
            for x in range(a.width):
                px, py = (x + 0.5) / a.width * source_width, (y + 0.5) / a.height * source_height
                visible = 0.03 < x / a.width < 0.9 and 0.17 < y / a.height < 0.88
                for capture in (first, second):
                    s = capture["state"]
                    visible = visible and math.hypot(px - s["activeX"], py - s["activeY"]) > max(18, s["starRadiusPx"] * 1.35)
                values.append(255 if visible else 0)
        mask.putdata(values)
        if not any(values):
            evidence.append({"from": first_name, "to": second_name, "backgroundCoverage": 0})
            continue
        evidence.append({"from": first_name, "to": second_name,
                         "backgroundCoverage": sum(value > 0 for value in values) / len(values),
                         "backgroundMeanBefore": ImageStat.Stat(a, mask).mean,
                         "backgroundMeanAfter": ImageStat.Stat(b, mask).mean,
                         "backgroundDifference": statistics.mean(ImageStat.Stat(ImageChops.difference(a, b), mask).mean),
                         "mask": "shared crop outside both photospheres + 35% margin; excludes HUD edges; corona may contribute"})
    report["backgroundReviewEvidence"] = evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="Existing static server; otherwise start an isolated local server")
    parser.add_argument("--output", type=Path, default=Path("/tmp/universe-os-lod-smoke"))
    parser.add_argument("--record-video", action="store_true", help="Record the journey and slower review pacing; FPS is diagnostic, not a benchmark")
    parser.add_argument("--journey", choices=("all", "planets", "solar", "jupiter", "nebula", "galaxies", "moons", "comets", "pulsars", "blackholes", "systems", "inner", "smallworlds", "routes", "motion", "context", "reading", "camera", "quality", "revisit", "discovery", "feedback", "scale"), default="all", help="Focused body, discovery, routes, motion, reading, camera, navigation feedback, scale navigation, scientific context or revisitation journey, or complete observatory journeys")
    parser.add_argument("--quality", choices=("safe", "standard", "immersive"), default="safe", help="Initial profile for scale and body reviews; the quality journey exercises its own profiles")
    parser.add_argument("--performance", action="store_true", help="Opt-in real GPU quality timing review; does not certify OS presentation or another device")
    parser.add_argument("--headed", action="store_true", help="Run a visible automation browser")
    parser.add_argument("--channel", default="chromium", help="Browser channel (default: full Chromium headless, for Worker WebGPU)")
    args = parser.parse_args()
    try:
        from PIL import Image, ImageChops, ImageStat
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        print(f"Environment unavailable: {error}. Install tests/requirements.txt in a venv.", file=sys.stderr)
        return 2
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"captures": [], "travel": [], "events": [], "recordVideo": args.record_video, "qualityProfile": args.quality, "status": "running"}
    try:
        with server_url(args.url) as url, sync_playwright() as playwright:
            options = {"headless": not args.headed, "args": ["--enable-unsafe-webgpu"]}
            if args.channel:
                options["channel"] = args.channel
            try:
                browser = playwright.chromium.launch(**options)
            except Exception as error:
                raise EnvironmentUnavailable(str(error)) from error
            try:
                if args.journey == "all":
                    run(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "planets"):
                    run_planets(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "solar"):
                    run_solar(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "jupiter"):
                    run_jupiter(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "nebula"):
                    run_nebula(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "galaxies"):
                    run_galaxies(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "moons"):
                    run_moons(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "comets"):
                    run_comets(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "blackholes"):
                    run_blackholes(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "pulsars"):
                    run_pulsars(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "systems"):
                    run_systems(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "smallworlds"):
                    run_small_worlds(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "inner"):
                    run_inner_worlds(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "routes"):
                    run_routes(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "motion"):
                    run_motion(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "context"):
                    run_context(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "reading"):
                    run_reading(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "camera"):
                    run_camera(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "quality"):
                    run_quality(browser, url, args.output, report, Image, ImageChops, ImageStat, args.performance)
                if args.journey in ("all", "revisit"):
                    run_revisit(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "discovery"):
                    run_discovery(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "feedback"):
                    run_feedback(browser, url, args.output, report, Image, ImageChops, ImageStat)
                if args.journey in ("all", "scale"):
                    run_scale_navigation(browser, url, args.output, report)
            finally:
                browser.close()
        if args.journey == "all":
            background_evidence(report, Image, ImageChops, ImageStat)
        report["status"] = "passed"
        print(f"Journey passed. Review images and evidence: {args.output}")
        return 0
    except EnvironmentUnavailable as error:
        report.update(status="environment-unavailable", error=str(error))
        print(f"Environment unavailable: {error}", file=sys.stderr)
        return 2
    except Exception as error:
        report.update(status="failed", error=str(error))
        raise
    finally:
        (args.output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
