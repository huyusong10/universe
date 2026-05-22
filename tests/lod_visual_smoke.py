#!/usr/bin/env python3
"""Smoke-check the observatory LOD path and capture review screenshots."""

from __future__ import annotations

import contextlib
import io
import math
import re
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path("/tmp/universe-os-lod-smoke")
CONTACT_SHEET_SEQUENCE = (
  "galactic",
  "galactic-regional-tail",
  "galactic-regional-mix",
  "regional-entry",
  "regional-mid",
  "local-map-entry",
  "local-system-entry",
  "local-system",
  "sphere-emerge",
  "sphere-close",
  "surface-settled",
  "surface-spin-b",
  "surface-orbit-a",
  "surface-orbit-b",
  "click-sphere-close",
  "focused-deep",
  "zoom-out",
)

DEBUG_FLOAT_KEYS = (
  "scale",
  "scaleTarget",
  "cameraYaw",
  "cameraTilt",
  "cameraFov",
  "distance",
  "distanceTarget",
  "scaleDepth",
  "scaleAxisProgress",
  "bridge",
  "exposure",
  "globalVeilPresence",
  "overlayHazeBudget",
  "rotationPhase",
  "surfaceSpinPhase",
  "activity",
  "localReference",
  "localApproach",
  "regionalBridgePresence",
  "localMapBridgePresence",
  "activeBridgePresence",
  "metricCatalogPresence",
  "metricLayerPresence",
  "metricLayerPointScale",
  "metricLayerHaloScale",
  "metricPsfContinuity",
  "metricLayerLabelWeight",
  "metricLayerPickWeight",
  "metricLayerOpacity",
  "metricCoreVisibility",
  "metricCoreRadiusScale",
  "galacticLayerPresence",
  "galacticLayerPointScale",
  "galacticLayerHaloScale",
  "galacticLayerLabelWeight",
  "galacticLayerPickWeight",
  "regionalLayerPresence",
  "regionalLayerPointScale",
  "regionalLayerHaloScale",
  "regionalLayerLabelWeight",
  "regionalLayerPickWeight",
  "localMapLayerPresence",
  "localMapLayerPointScale",
  "localMapLayerHaloScale",
  "localMapLayerLabelWeight",
  "localMapLayerPickWeight",
  "localSystemLayerPresence",
  "localSystemLayerPointScale",
  "localSystemLayerHaloScale",
  "localSystemLayerLabelWeight",
  "localSystemLayerPickWeight",
  "surfaceLayerPresence",
  "surfaceLayerPointScale",
  "surfaceLayerHaloScale",
  "surfaceLayerLabelWeight",
  "surfaceLayerPickWeight",
  "celestialBackdropPresence",
  "localSystemPresence",
  "activeStarCloseness",
  "surfaceReadiness",
  "surfaceDepth",
  "surfaceViewRadiusStarR",
  "contextScale",
  "activeImpostorScale",
  "activeHaloRatio",
  "activeGlowStrength",
  "activeGlowRadius",
  "stellarOpticalLeadIn",
  "activePrimaryAlpha",
  "activeSurfaceDetailAlpha",
  "activePhotosphereAlpha",
  "activeCoronaAlpha",
  "approach",
  "surface",
  "surfacePresence",
  "surfaceRadius",
  "sphereRadius",
  "sphereScreenRadius",
  "sphereDraw",
  "sphereVisibility",
  "localMapContext",
  "activeX",
  "activeY",
  "activeLabelX",
  "activeLabelY",
)
DEBUG_INT_KEYS = ("catalog", "draw", "labels", "sphereTriangles", "sphereDraw")


def free_port() -> int:
  with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
    sock.bind(("127.0.0.1", 0))
    return int(sock.getsockname()[1])


def wait_for_port(port: int, timeout: float = 10.0) -> None:
  deadline = time.time() + timeout
  while time.time() < deadline:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
      sock.settimeout(0.25)
      if sock.connect_ex(("127.0.0.1", port)) == 0:
        return
    time.sleep(0.05)
  raise RuntimeError(f"server did not start on port {port}")


def start_server(port: int) -> subprocess.Popen[str]:
  process = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
    cwd=ROOT,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.STDOUT,
    text=True,
  )
  wait_for_port(port)
  return process


def debug_state(page) -> dict[str, object]:
  text = page.locator("#debug").inner_text(timeout=5000)
  state: dict[str, object] = {}
  for token in re.split(r"\s+", text.strip()):
    if "=" not in token:
      continue
    key, value = token.split("=", 1)
    state[key] = value
  required = {"version", "lod", "scale", "catalog", "draw", "labels", "gpu"}
  if not required.issubset(state):
    raise AssertionError(f"debug state was not parseable: {text!r}")
  for key in DEBUG_FLOAT_KEYS:
    if key in state:
      state[key] = float(str(state[key]))
  for key in DEBUG_INT_KEYS:
    if key in state:
      state[key] = int(float(str(state[key])))
  return state


def capture(page, name: str, wait_ms: int = 850) -> dict[str, object]:
  page.wait_for_timeout(wait_ms)
  unsupported = page.locator("#unsupported").get_attribute("data-visible")
  if unsupported == "true":
    message = page.locator("#unsupported").inner_text(timeout=5000)
    raise AssertionError(f"observatory reported runtime error during {name}: {message}")
  state = debug_state(page)
  page.screenshot(path=str(OUT_DIR / f"{name}.png"))
  print(f"{name}: {state}")
  return state


def create_contact_sheet() -> Path:
  paths = [(name, OUT_DIR / f"{name}.png") for name in CONTACT_SHEET_SEQUENCE]
  captures = [(name, path) for name, path in paths if path.exists()]
  if not captures:
    raise AssertionError("no LOD screenshots were available for the contact sheet")

  thumb_width = 360
  thumb_height = 225
  label_height = 28
  gap = 10
  columns = 4
  rows = math.ceil(len(captures) / columns)
  sheet_width = columns * thumb_width + (columns + 1) * gap
  sheet_height = rows * (thumb_height + label_height) + (rows + 1) * gap
  sheet = Image.new("RGB", (sheet_width, sheet_height), (7, 10, 16))
  draw = ImageDraw.Draw(sheet)
  resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS")

  for index, (name, path) in enumerate(captures):
    column = index % columns
    row = index // columns
    x = gap + column * (thumb_width + gap)
    y = gap + row * (thumb_height + label_height + gap)
    with Image.open(path) as source:
      thumbnail = source.convert("RGB")
    thumbnail.thumbnail((thumb_width, thumb_height), resample)
    thumb_x = x + (thumb_width - thumbnail.width) // 2
    thumb_y = y + label_height + (thumb_height - thumbnail.height) // 2
    sheet.paste(thumbnail, (thumb_x, thumb_y))
    draw.text((x + 8, y + 7), name, fill=(214, 224, 238))
    draw.rectangle((x, y + label_height, x + thumb_width - 1, y + label_height + thumb_height - 1), outline=(38, 50, 68))

  contact_sheet = OUT_DIR / "contact-sheet.jpg"
  sheet.save(contact_sheet, quality=92)
  return contact_sheet


def send_wheel(page, delta_y: int) -> None:
  page.locator("#scene").dispatch_event(
    "wheel",
    {
      "deltaY": delta_y,
      "clientX": 720,
      "clientY": 450,
      "bubbles": True,
      "cancelable": True,
    },
  )


def send_drag(page, start_x: int, start_y: int, end_x: int, end_y: int, steps: int = 16) -> None:
  before = debug_state(page)

  def camera_rotated(timeout_ms: int = 900) -> bool:
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
      page.wait_for_timeout(90)
      after = debug_state(page)
      if abs(float(after.get("cameraYaw", 0)) - float(before.get("cameraYaw", 0))) >= 0.035:
        return True
    return False

  page.mouse.move(start_x, start_y)
  page.mouse.down()
  page.mouse.move(end_x, end_y, steps=steps)
  page.mouse.up()
  if camera_rotated():
    return

  scene = page.locator("#scene")
  pointer_id = 17

  def pointer_payload(x: float, y: float, buttons: int) -> dict[str, object]:
    return {
      "pointerId": pointer_id,
      "pointerType": "mouse",
      "isPrimary": True,
      "button": 0,
      "buttons": buttons,
      "clientX": x,
      "clientY": y,
      "bubbles": True,
      "cancelable": True,
    }

  def dispatch_pointer(event_type: str, payload: dict[str, object]) -> None:
    scene.evaluate(
      """(canvas, args) => {
        const [eventType, eventInit] = args;
        canvas.dispatchEvent(new PointerEvent(eventType, eventInit));
      }""",
      [event_type, payload],
    )

  dispatch_pointer("pointerdown", pointer_payload(start_x, start_y, 1))
  for step in range(1, steps + 1):
    t = step / steps
    x = start_x + (end_x - start_x) * t
    y = start_y + (end_y - start_y) * t
    dispatch_pointer("pointermove", pointer_payload(x, y, 1))
    page.wait_for_timeout(16)
  dispatch_pointer("pointerup", pointer_payload(end_x, end_y, 0))
  if camera_rotated():
    return

  used_hook = page.evaluate(
    """({ startX, startY, endX, endY, steps }) => {
      if (typeof window.__universeOsDebugDrag === "function") {
        for (let step = 1; step <= steps; step += 1) {
          const previousT = (step - 1) / steps;
          const t = step / steps;
          const previousX = startX + (endX - startX) * previousT;
          const previousY = startY + (endY - startY) * previousT;
          const x = startX + (endX - startX) * t;
          const y = startY + (endY - startY) * t;
          window.__universeOsDebugDrag({ x, y, dx: x - previousX, dy: y - previousY });
        }
        return true;
      }
      return false;
    }""",
    {
      "startX": start_x,
      "startY": start_y,
      "endX": end_x,
      "endY": end_y,
      "steps": max(4, steps),
    },
  )
  if used_hook and camera_rotated(timeout_ms=1200):
    return


def wait_for_observatory(page) -> None:
  page.wait_for_function(
    """() => {
      const debug = document.querySelector("#debug");
      const unsupported = document.querySelector("#unsupported");
      return unsupported?.dataset.visible === "true" ||
        (debug && debug.textContent.includes("lod="));
    }""",
    timeout=60000,
  )
  unsupported = page.locator("#unsupported").get_attribute("data-visible")
  if unsupported == "true":
    message = page.locator("#unsupported").inner_text(timeout=5000)
    raise AssertionError(f"observatory reported unsupported runtime: {message}")


def wheel_until(
  page,
  target_lod: str,
  delta_y: int,
  max_steps: int = 64,
  samples: list[dict[str, object]] | None = None,
) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if samples is not None:
      samples.append(state)
    if state["lod"] == target_lod:
      return state
    send_wheel(page, delta_y)
    page.wait_for_timeout(520)
  state = debug_state(page)
  raise AssertionError(f"expected {target_lod}, reached {state}")


def wheel_until_stage(
  page,
  target_stage: str,
  delta_y: int,
  max_steps: int = 64,
  samples: list[dict[str, object]] | None = None,
) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if samples is not None:
      samples.append(state)
    if state.get("scaleStage") == target_stage:
      return state
    send_wheel(page, delta_y)
    page.wait_for_timeout(520)
  state = debug_state(page)
  raise AssertionError(f"expected scaleStage={target_stage}, reached {state}")


def wheel_until_layer_mix(
  page,
  left_key: str,
  right_key: str,
  delta_y: int,
  floor: float = 0.25,
  ceiling: float = 0.78,
  max_steps: int = 64,
  samples: list[dict[str, object]] | None = None,
) -> dict[str, object]:
  def mixed(state: dict[str, object]) -> bool:
    left = float(state.get(left_key, 0))
    right = float(state.get(right_key, 0))
    return floor <= left <= ceiling and floor <= right <= ceiling

  for _ in range(max_steps):
    state = debug_state(page)
    if samples is not None:
      samples.append(state)
    if mixed(state):
      return state
    send_wheel(page, delta_y)
    for _ in range(6):
      page.wait_for_timeout(86)
      state = debug_state(page)
      if samples is not None:
        samples.append(state)
      if mixed(state):
        return state
  state = debug_state(page)
  raise AssertionError(f"expected mixed layer state for {left_key}/{right_key}, reached {state}")


def wheel_until_metric_at_most(
  page,
  key: str,
  maximum: float,
  delta_y: int,
  max_steps: int = 64,
  samples: list[dict[str, object]] | None = None,
) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if samples is not None:
      samples.append(state)
    if float(state.get(key, 0)) <= maximum:
      return state
    send_wheel(page, delta_y)
    page.wait_for_timeout(520)
  state = debug_state(page)
  raise AssertionError(f"expected {key} <= {maximum}, reached {state}")


def wheel_until_metric_at_least(
  page,
  key: str,
  minimum: float,
  delta_y: int,
  max_steps: int = 64,
  samples: list[dict[str, object]] | None = None,
) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if samples is not None:
      samples.append(state)
    if float(state.get(key, 0)) >= minimum:
      return state
    send_wheel(page, delta_y)
    page.wait_for_timeout(420)
  state = debug_state(page)
  raise AssertionError(f"expected {key} >= {minimum}, reached {state}")


def sphere_radius(state: dict[str, object]) -> float:
  return float(state.get("sphereScreenRadius", state.get("surfaceRadius", 0)))


def assert_sphere_growth_continuity(samples: list[dict[str, object]]) -> None:
  in_range = [state for state in samples if 60 <= sphere_radius(state) <= 200]
  if len(in_range) < 4:
    if len(in_range) >= 2:
      first = sphere_radius(in_range[0])
      last = sphere_radius(in_range[-1])
      if first < 96 and last > 170:
        raise AssertionError(
          f"sphere radius skipped the local-system bridge: previous={first:.1f} current={last:.1f} samples={in_range}"
        )
      return
    raise AssertionError(f"not enough sphere transition samples for continuity check: {in_range}")
  previous = sphere_radius(in_range[0])
  for state in in_range[1:]:
    radius = sphere_radius(state)
    if radius / max(previous, 0.001) > 2.35:
      raise AssertionError(
        f"sphere radius jumped too quickly: previous={previous:.1f} current={radius:.1f} state={state}"
      )
    if previous < 96 and radius > 170:
      raise AssertionError(
        f"sphere radius skipped the local-system bridge: previous={previous:.1f} current={radius:.1f} state={state}"
      )
    previous = radius


def assert_no_static_impostor_plateau(samples: list[dict[str, object]]) -> None:
  readable = [
    state
    for state in samples
    if sphere_radius(state) >= 92
    and float(state.get("surfacePresence", state.get("surface", 0))) >= 0.08
  ]
  if not readable:
    raise AssertionError(f"no readable sphere handoff samples were available: {samples}")
  lingering = [
    state
    for state in readable
    if float(state.get("activeImpostorScale", 1)) > 0.58
  ]
  if lingering:
    raise AssertionError(f"active impostor stayed dominant after the sphere became readable: {lingering}")
  late = [
    state
    for state in samples
    if sphere_radius(state) >= 150
    and float(state.get("surfaceReadiness", 0)) >= 0.24
    and float(state.get("activeImpostorScale", 1)) > 0.26
  ]
  if late:
    raise AssertionError(f"active impostor plateau persisted into Surface handoff: {late}")


def assert_surface_handoff_progression(samples: list[dict[str, object]]) -> None:
  closeness = [float(state.get("activeStarCloseness", 0)) for state in samples]
  if len(closeness) >= 2 and any(right + 0.03 < left for left, right in zip(closeness, closeness[1:])):
    raise AssertionError(f"active star presentation did not progress monotonically inward: {samples}")
  if not any(
    (
      float(state.get("localSystemLayerPresence", 0)) >= 0.30
      or (
        state.get("scaleStage") == "LocalSystem"
        and float(state.get("localSystemPresence", 0)) >= 0.55
        and float(state.get("surfaceReadiness", 0)) < 0.66
      )
    )
    and float(state.get("surfaceLayerPresence", 0)) <= 0.30
    for state in samples
  ):
    raise AssertionError(f"Surface handoff did not include a LocalSystem-owned lead-in: {samples}")
  if not any(
    float(state.get("surfaceLayerPresence", 0)) >= 0.45
    and float(state.get("localSystemLayerPresence", 1)) <= 0.18
    for state in samples
  ):
    raise AssertionError(f"Surface handoff did not retire LocalSystem before sphere takeover: {samples}")
  competing = [
    state
    for state in samples
    if float(state.get("surfaceLayerPresence", 0)) > 0.38
    and float(state.get("localSystemLayerPresence", 0)) > 0.22
  ]
  if competing:
    raise AssertionError(f"Surface and LocalSystem both claimed primary ownership: {competing}")


def assert_surface_spin_progression(samples: list[dict[str, object]]) -> None:
  readable = [
    state
    for state in samples
    if sphere_radius(state) >= 60
    and float(state.get("surfacePresence", state.get("surface", 0))) >= 0.05
  ]
  if len(readable) < 2:
    raise AssertionError(f"no readable surface samples were available for spin validation: {samples}")
  phases = [float(state.get("surfaceSpinPhase", -1)) for state in readable]
  if any(phase < 0 or phase >= 1 for phase in phases):
    raise AssertionError(f"surface spin phase left the normalized range: {readable}")
  cumulative = 0.0
  for left, right in zip(phases, phases[1:]):
    delta = abs(right - left)
    cumulative += min(delta, 1 - delta)
  if cumulative < 0.012:
    raise AssertionError(
      "near-field photosphere did not expose continuous self-rotation "
      f"(phases={phases}, samples={readable})"
    )


def assert_surface_visual_spin(
  left_name: str,
  left_state: dict[str, object],
  right_name: str,
  right_state: dict[str, object],
) -> None:
  left_phase = float(left_state.get("surfaceSpinPhase", 0))
  right_phase = float(right_state.get("surfaceSpinPhase", left_phase))
  phase_delta = abs(right_phase - left_phase)
  phase_delta = min(phase_delta, 1 - phase_delta)
  if phase_delta < 0.018:
    raise AssertionError(
      f"surface spin debug phase did not move enough for visual validation: "
      f"{left_state} -> {right_state}"
    )

  left_image = Image.open(OUT_DIR / f"{left_name}.png").convert("L")
  right_image = Image.open(OUT_DIR / f"{right_name}.png").convert("L")
  active_x = (float(left_state.get("activeX", left_image.width * 0.5)) + float(right_state.get("activeX", right_image.width * 0.5))) * 0.5
  active_y = (float(left_state.get("activeY", left_image.height * 0.5)) + float(right_state.get("activeY", right_image.height * 0.5))) * 0.5
  radius = min(
    float(left_state.get("sphereScreenRadius", 0)),
    float(right_state.get("sphereScreenRadius", 0)),
  )
  if radius < 100:
    raise AssertionError(f"surface visual spin needs a readable sphere: {left_state} -> {right_state}")
  crop_radius = int(min(radius * 0.54, min(left_image.width, left_image.height) * 0.26))
  left = max(0, int(active_x) - crop_radius)
  top = max(120, int(active_y) - crop_radius)
  right = min(left_image.width, int(active_x) + crop_radius)
  bottom = min(left_image.height, int(active_y) + crop_radius)
  crop_a = left_image.crop((left, top, right, bottom))
  crop_b = right_image.crop((left, top, right, bottom))
  raw_delta = ImageStat.Stat(ImageChops.difference(crop_a, crop_b)).mean[0]
  detail_a = ImageChops.difference(crop_a, crop_a.filter(ImageFilter.GaussianBlur(radius=3.0)))
  detail_b = ImageChops.difference(crop_b, crop_b.filter(ImageFilter.GaussianBlur(radius=3.0)))
  detail_delta = ImageStat.Stat(ImageChops.difference(detail_a, detail_b)).mean[0]
  motion_a = crop_a.filter(ImageFilter.GaussianBlur(radius=1.1))
  motion_b = crop_b.filter(ImageFilter.GaussianBlur(radius=1.1))
  no_shift_delta = ImageStat.Stat(ImageChops.difference(motion_a, motion_b)).mean[0]
  max_shift = int(min(56, max(10, radius * 0.38)))
  best_shift = 0
  best_shift_delta = no_shift_delta
  best_axis = "x"
  for shift in range(-max_shift, max_shift + 1):
    if shift == 0:
      continue
    if shift > 0:
      shifted_a = motion_a.crop((shift, 0, motion_a.width, motion_a.height))
      shifted_b = motion_b.crop((0, 0, motion_b.width - shift, motion_b.height))
    else:
      shifted_a = motion_a.crop((0, 0, motion_a.width + shift, motion_a.height))
      shifted_b = motion_b.crop((-shift, 0, motion_b.width, motion_b.height))
    if shifted_a.width < 20 or shifted_a.height < 20:
      continue
    shifted_delta = ImageStat.Stat(ImageChops.difference(shifted_a, shifted_b)).mean[0]
    if shifted_delta < best_shift_delta:
      best_shift_delta = shifted_delta
      best_shift = shift
      best_axis = "x"
    if shift > 0:
      shifted_a = motion_a.crop((0, shift, motion_a.width, motion_a.height))
      shifted_b = motion_b.crop((0, 0, motion_b.width, motion_b.height - shift))
    else:
      shifted_a = motion_a.crop((0, 0, motion_a.width, motion_a.height + shift))
      shifted_b = motion_b.crop((0, -shift, motion_b.width, motion_b.height))
    if shifted_a.width < 20 or shifted_a.height < 20:
      continue
    shifted_delta = ImageStat.Stat(ImageChops.difference(shifted_a, shifted_b)).mean[0]
    if shifted_delta < best_shift_delta:
      best_shift_delta = shifted_delta
      best_shift = shift
      best_axis = "y"
  if raw_delta < 0.70 and detail_delta < 0.34:
    raise AssertionError(
      f"surface photosphere looked screen-locked instead of visibly self-rotating "
      f"(raw_delta={raw_delta:.3f}, detail_delta={detail_delta:.3f}, phase_delta={phase_delta:.3f}, "
      f"states={left_state} -> {right_state})"
    )
  if abs(best_shift) < 3 or best_shift_delta > no_shift_delta * 0.985:
    raise AssertionError(
      f"surface photosphere changed, but did not read as coherent longitudinal self-rotation "
      f"(best_shift={best_shift}, best_axis={best_axis}, best_delta={best_shift_delta:.3f}, "
      f"no_shift_delta={no_shift_delta:.3f}, raw_delta={raw_delta:.3f}, "
      f"detail_delta={detail_delta:.3f}, phase_delta={phase_delta:.3f}, "
      f"states={left_state} -> {right_state})"
    )


def assert_surface_orbit_model_response(
  left_name: str,
  left_state: dict[str, object],
  right_name: str,
  right_state: dict[str, object],
) -> None:
  yaw_delta = abs(float(right_state.get("cameraYaw", 0)) - float(left_state.get("cameraYaw", 0)))
  if yaw_delta < 0.035:
    raise AssertionError(f"dragging near the active sphere did not rotate the camera: {left_state} -> {right_state}")

  left_image = Image.open(OUT_DIR / f"{left_name}.png").convert("L")
  right_image = Image.open(OUT_DIR / f"{right_name}.png").convert("L")
  active_x = (float(left_state.get("activeX", left_image.width * 0.5)) + float(right_state.get("activeX", right_image.width * 0.5))) * 0.5
  active_y = (float(left_state.get("activeY", left_image.height * 0.5)) + float(right_state.get("activeY", right_image.height * 0.5))) * 0.5
  radius = min(float(left_state.get("sphereScreenRadius", 0)), float(right_state.get("sphereScreenRadius", 0)))
  if radius < 100:
    raise AssertionError(f"surface orbit check needs a readable sphere: {left_state} -> {right_state}")

  crop_radius = int(min(radius * 0.58, min(left_image.width, left_image.height) * 0.28))
  left = max(0, int(active_x) - crop_radius)
  top = max(120, int(active_y) - crop_radius)
  right = min(left_image.width, int(active_x) + crop_radius)
  bottom = min(left_image.height, int(active_y) + crop_radius)
  crop_a = left_image.crop((left, top, right, bottom))
  crop_b = right_image.crop((left, top, right, bottom))

  width, height = crop_a.size
  mask = Image.new("L", crop_a.size, 0)
  draw = ImageDraw.Draw(mask)
  draw.ellipse((width * 0.10, height * 0.10, width * 0.90, height * 0.90), fill=255)
  diff = ImageChops.difference(crop_a, crop_b)
  raw_delta = ImageStat.Stat(diff, mask).mean[0]
  detail_a = ImageChops.difference(crop_a, crop_a.filter(ImageFilter.GaussianBlur(radius=3.0)))
  detail_b = ImageChops.difference(crop_b, crop_b.filter(ImageFilter.GaussianBlur(radius=3.0)))
  detail_delta = ImageStat.Stat(ImageChops.difference(detail_a, detail_b), mask).mean[0]
  if raw_delta < 0.55 and detail_delta < 0.26:
    raise AssertionError(
      f"dragging rotated the scene but the active stellar body still looked screen-locked "
      f"(yaw_delta={yaw_delta:.3f}, raw_delta={raw_delta:.3f}, detail_delta={detail_delta:.3f}, "
      f"states={left_state} -> {right_state})"
    )


def wheel_through_sphere_transition(page, delta_y: int = -14, max_steps: int = 360, seed_samples: list[dict[str, object]] | None = None):
  samples: list[dict[str, object]] = list(seed_samples or [])
  sphere_emerge = None
  sphere_close = None
  for _ in range(max_steps):
    state = debug_state(page)
    radius = sphere_radius(state)
    local_approach = float(state.get("localApproach", 0))
    if 60 <= radius <= 200:
      samples.append(state)
    surface = float(state.get("surfacePresence", state.get("surface", 0)))
    readiness = float(state.get("surfaceReadiness", 0))
    if sphere_emerge is None and 70 <= radius <= 180 and 0.20 <= local_approach <= 0.95 and 0.02 <= surface < 0.72 and readiness < 0.82:
      sphere_emerge = capture(page, "sphere-emerge", wait_ms=0)
      samples.append(sphere_emerge)
    surface_layer = float(state.get("surfaceLayerPresence", 0))
    if (
      118 <= radius <= 190
      and readiness >= 0.48
      and surface_layer >= 0.45
      and state.get("scaleStage") == "Surface"
    ):
      sphere_close = capture(page, "sphere-close", wait_ms=250)
      samples.append(sphere_close)
      assert_sphere_growth_continuity(samples)
      assert_no_static_impostor_plateau(samples)
      assert_surface_handoff_progression(samples)
      if sphere_emerge is None:
        raise AssertionError(f"sphere transition skipped the emergence window: {samples}")
      return samples, sphere_emerge, sphere_close
    send_wheel(page, 90 if radius > 188 else delta_y)
    page.wait_for_timeout(180)
  state = debug_state(page)
  raise AssertionError(f"expected sphere transition through close state, reached {state}")


def wait_until_metric_at_least(page, key: str, minimum: float, max_steps: int = 16) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if float(state.get(key, 0)) >= minimum:
      return state
    page.wait_for_timeout(420)
  state = debug_state(page)
  raise AssertionError(f"expected {key} >= {minimum}, reached {state}")


def wait_until_metric_at_most(page, key: str, maximum: float, max_steps: int = 16) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if float(state.get(key, 0)) <= maximum:
      return state
    page.wait_for_timeout(420)
  state = debug_state(page)
  raise AssertionError(f"expected {key} <= {maximum}, reached {state}")


def wait_until_surface_stage(page, minimum_surface: float = 0.45, max_steps: int = 48) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if state.get("scaleStage") == "Surface" and float(state.get("surfacePresence", 0)) >= minimum_surface:
      return state
    page.wait_for_timeout(420)
  state = debug_state(page)
  raise AssertionError(f"click approach should arrive in the Surface stage: {state}")


def wait_until_camera_near_target(page, ratio: float = 1.16, max_steps: int = 32) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    distance = float(state.get("distance", 0))
    target = float(state.get("distanceTarget", distance))
    if distance <= target * ratio + 4:
      return state
    page.wait_for_timeout(420)
  state = debug_state(page)
  raise AssertionError(f"camera did not settle near its target distance: {state}")


def assert_wheel_targets_before_camera(page, start_state: dict[str, object]) -> dict[str, object]:
  page.mouse.move(720, 450)
  page.wait_for_timeout(120)
  state = start_state
  for _ in range(5):
    send_wheel(page, -520)
    page.wait_for_timeout(420)
    state = debug_state(page)
    if float(state["distanceTarget"]) < float(start_state["distanceTarget"]):
      break
  else:
    raise AssertionError(f"wheel did not move target distance inward: {start_state} -> {state}")
  if float(state["distance"]) <= float(state["distanceTarget"]):
    raise AssertionError(f"camera distance did not smoothly follow target distance: {state}")
  return state


def assert_state(state: dict[str, object]) -> None:
  if not str(state["version"]).startswith(("newnew-stars-observatory-", "unified-active-star-")):
    raise AssertionError(f"debug state did not expose a recognizable runtime version: {state}")
  if state["gpu"] != "webgpu":
    raise AssertionError(f"expected webgpu renderer, got {state}")
  if state.get("starModel") != "sphere":
    raise AssertionError(f"expected active star to use the sphere model: {state}")
  if state.get("stellarMaterial") != "emissive":
    raise AssertionError(f"expected active star to use emissive stellar material: {state}")
  phase = float(state.get("rotationPhase", -1))
  if not (0 <= phase < 1):
    raise AssertionError(f"stellar rotation phase was outside normalized bounds: {state}")
  spin_phase = float(state.get("surfaceSpinPhase", -1))
  if not (0 <= spin_phase < 1):
    raise AssertionError(f"stellar surface spin phase was outside normalized bounds: {state}")
  activity = float(state.get("activity", -1))
  if not (0 <= activity <= 1):
    raise AssertionError(f"stellar activity was outside normalized bounds: {state}")
  camera_fov = float(state.get("cameraFov", -1))
  if not (23.9 <= camera_fov <= 40.1):
    raise AssertionError(f"camera FOV escaped expected bounds: {state}")
  if state.get("scaleStage") not in {"Galactic", "Regional", "LocalMap", "LocalSystem", "Surface"}:
    raise AssertionError(f"debug state did not expose a valid scale stage: {state}")
  scale_depth = float(state.get("scaleDepth", -1))
  if not (0 <= scale_depth <= 1.01):
    raise AssertionError(f"scale depth escaped normalized bounds: {state}")
  scale_axis = float(state.get("scaleAxisProgress", -1))
  if not (0 <= scale_axis <= 1.01):
    raise AssertionError(f"semantic scale axis progress escaped normalized bounds: {state}")
  for key in (
    "metricCatalogPresence",
    "metricLayerPointScale",
    "metricLayerHaloScale",
    "metricLayerLabelWeight",
    "metricLayerPickWeight",
    "metricCoreVisibility",
    "metricCoreRadiusScale",
    "activeBridgePresence",
    "globalVeilPresence",
    "overlayHazeBudget",
    "celestialBackdropPresence",
    "localSystemPresence",
    "surfaceReadiness",
    "surfaceDepth",
    "surfaceViewRadiusStarR",
    "galacticLayerPresence",
    "regionalLayerPresence",
    "localMapLayerPresence",
    "localSystemLayerPresence",
    "localSystemLayerHaloScale",
    "surfaceLayerPresence",
    "surfaceLayerHaloScale",
    "activeHaloRatio",
  ):
    if key not in state:
      raise AssertionError(f"debug state did not expose {key}: {state}")
  for key in (
    "metricCatalogPresence",
    "metricLayerPresence",
    "metricLayerPointScale",
    "metricLayerHaloScale",
    "metricLayerLabelWeight",
    "metricLayerPickWeight",
    "metricCoreVisibility",
    "metricCoreRadiusScale",
    "regionalBridgePresence",
    "localMapBridgePresence",
    "activeBridgePresence",
    "globalVeilPresence",
    "overlayHazeBudget",
    "celestialBackdropPresence",
    "localSystemPresence",
    "surfaceReadiness",
    "surfaceDepth",
    "galacticLayerPresence",
    "regionalLayerPresence",
    "localMapLayerPresence",
    "localSystemLayerPresence",
    "localSystemLayerHaloScale",
    "surfaceLayerPresence",
    "surfaceLayerHaloScale",
  ):
    value = float(state.get(key, -1))
    if not (0 <= value <= 1.01):
      raise AssertionError(f"{key} escaped normalized bounds: {state}")
  triangles = int(state.get("sphereTriangles", 0))
  if not (0 < triangles <= 10000):
    raise AssertionError(f"sphere triangle budget escaped fixed bounds: {state}")
  if int(state["labels"]) > 60:
    raise AssertionError(f"label budget escaped fixed bounds: {state}")
  if int(state["draw"]) > int(state["catalog"]):
    raise AssertionError(f"draw count exceeded catalog count: {state}")
  if float(state.get("surfacePresence", 0)) >= 0.25:
    if int(state.get("sphereDraw", 0)) != 1:
      raise AssertionError(f"visible sphere state did not submit the active sphere pass: {state}")
  if float(state.get("surfaceReadiness", 0)) >= 0.20:
    if float(state.get("sphereVisibility", 0)) < 0.25:
      raise AssertionError(f"visible sphere state did not report visible sphere strength: {state}")
  local_context = float(state.get("localMapContext", 1))
  if not (0 <= local_context <= 1.01):
    raise AssertionError(f"local map context escaped expected bounds: {state}")
  local_approach = float(state.get("localApproach", 0))
  if not (0 <= local_approach <= 1.01):
    raise AssertionError(f"local approach escaped normalized bounds: {state}")
  context_scale = float(state.get("contextScale", 1))
  if not (0.03 <= context_scale <= 1.01):
    raise AssertionError(f"background context scale escaped expected bounds: {state}")
  active_impostor_scale = float(state.get("activeImpostorScale", 1))
  if not (0.02 <= active_impostor_scale <= 1.01):
    raise AssertionError(f"active impostor scale escaped expected bounds: {state}")
  active_halo_ratio = float(state.get("activeHaloRatio", 0))
  if not (0 <= active_halo_ratio <= 2.21):
    raise AssertionError(f"active halo ratio escaped expected bounds: {state}")
  active_glow_strength = float(state.get("activeGlowStrength", 0))
  if not (0 <= active_glow_strength <= 1.16):
    raise AssertionError(f"active glow strength escaped expected bounds: {state}")
  active_glow_radius = float(state.get("activeGlowRadius", 0))
  if active_glow_radius < 0:
    raise AssertionError(f"active glow radius escaped expected bounds: {state}")
  stellar_optical_lead_in = float(state.get("stellarOpticalLeadIn", 0))
  if not (0 <= stellar_optical_lead_in <= 0.83):
    raise AssertionError(f"active optical lead-in escaped expected bounds: {state}")
  active_star_closeness = float(state.get("activeStarCloseness", 0))
  if not (0 <= active_star_closeness <= 1.01):
    raise AssertionError(f"active star closeness escaped normalized bounds: {state}")
  for key in ("activePrimaryAlpha", "activeSurfaceDetailAlpha", "activePhotosphereAlpha", "activeCoronaAlpha"):
    value = float(state.get(key, 0))
    if not (0 <= value <= 1.16):
      raise AssertionError(f"{key} escaped normalized optical bounds: {state}")


def assert_active_label_off_center(state: dict[str, object]) -> None:
  radius = float(state.get("sphereScreenRadius", state.get("surfaceRadius", 0)))
  if radius <= 70:
    return
  active_x = float(state.get("activeX", -1000))
  active_y = float(state.get("activeY", -1000))
  label_x = float(state.get("activeLabelX", -1000))
  label_y = float(state.get("activeLabelY", -1000))
  if not (0 <= label_x <= 1440 and 0 <= label_y <= 900):
    raise AssertionError(f"active label was not screen-addressable: {state}")
  distance = math.hypot(label_x - active_x, label_y - active_y)
  minimum = min(80, radius * 0.28)
  if distance <= minimum:
    raise AssertionError(f"active label covered the sphere center: distance={distance:.1f}, state={state}")
  surface = float(state.get("surfacePresence", state.get("surface", 0)))
  if surface >= 0.18 and radius > 70 and distance < radius * 0.70:
    raise AssertionError(f"active label sat on the close photosphere: distance={distance:.1f}, state={state}")


def assert_axis_range(state: dict[str, object], minimum: float, maximum: float, label: str) -> None:
  value = float(state.get("scaleAxisProgress", -1))
  if not (minimum <= value <= maximum):
    raise AssertionError(f"{label} scale axis progress escaped [{minimum}, {maximum}]: {state}")


def assert_no_competing_primary_layers(state: dict[str, object]) -> None:
  if float(state.get("regionalLayerPresence", 0)) > 0.75 and float(state.get("galacticLayerPresence", 0)) > 0.85:
    raise AssertionError(f"regional layer took over while galactic layer still dominated: {state}")
  if float(state.get("localMapLayerPresence", 0)) > 0.75 and float(state.get("regionalLayerPresence", 0)) > 0.75:
    raise AssertionError(f"local map layer took over while regional layer still dominated: {state}")
  if float(state.get("surfaceLayerPresence", 0)) > 0.48 and float(state.get("localSystemLayerPresence", 0)) > 0.18:
    raise AssertionError(f"surface layer took over before local system layer began retreating: {state}")
  if (
    float(state.get("activeSurfaceDetailAlpha", 0)) > 0.72
    and float(state.get("surfaceReadiness", 0)) > 0.55
    and float(state.get("localSystemLayerPresence", 0)) > 0.18
  ):
    raise AssertionError(f"mature surface detail competed with the LocalSystem primary layer: {state}")
  if sphere_radius(state) > 118 and float(state.get("localSystemLayerPresence", 0)) > 0.20:
    raise AssertionError(f"LocalSystem reference layer persisted around a readable sphere: {state}")
  if float(state.get("sphereVisibility", 0)) > 0.45 and float(state.get("activeImpostorScale", 1)) > 0.24:
    raise AssertionError(f"readable sphere competed with the active billboard: {state}")
  if sphere_radius(state) > 118 and float(state.get("activeImpostorScale", 1)) > 0.30:
    raise AssertionError(f"active billboard lingered after sphere radius became readable: {state}")


def assert_no_global_blur_filter() -> None:
  worker_source = (ROOT / "assets" / "stars-observatory-worker.js").read_text(encoding="utf-8")
  if re.search(r"\.filter\s*=\s*[\"']blur\(", worker_source):
    raise AssertionError("LOD overlay must not use a global canvas blur filter for handoff")


def assert_star_core_not_layer_faded() -> None:
  worker_source = (ROOT / "assets" / "stars-observatory-worker.js").read_text(encoding="utf-8")
  if re.search(r"core\s*\*[^;\n]*metricOpacity", worker_source):
    raise AssertionError("star core energy must not be multiplied by LOD layer opacity")
  if "starRadius = select(starRadius * metricPointScale" in worker_source:
    raise AssertionError("star core radius must not be multiplied by LOD layer point scale")


def assert_sphere_shader_material_contract() -> None:
  worker_source = (ROOT / "assets" / "stars-observatory-worker.js").read_text(encoding="utf-8")
  match = re.search(r"const SPHERE_SHADER = `(?P<shader>.*?)`;", worker_source, re.S)
  if not match:
    raise AssertionError("active sphere shader was not discoverable")
  shader = match.group("shader")
  required = (
    "plasmaSurface",
    "triplanarFbm",
    "spunUnit",
    "uvNetwork",
    "uvFilament",
    "granulation",
    "faculae",
    "darkSpots",
    "edgeEmission",
    "chromosphereEmission",
    "whiteHeat",
    "rimBurn",
    "cellularHeat",
    "convectiveHeat",
    "stellarFloor",
    "photosphereFloor",
  )
  missing = [token for token in required if token not in shader]
  if missing:
    raise AssertionError(f"active sphere shader lost its emissive surface material terms: {missing}")
  if re.search(r"return\s+vec4f\(vec3f\([0-9.,\s]+\),\s*1\.0\)", shader):
    raise AssertionError("active sphere shader returned a constant diagnostic color")


def assert_active_baked_glow_contract() -> None:
  worker_source = (ROOT / "assets" / "stars-observatory-worker.js").read_text(encoding="utf-8")
  required = (
    "ensureStellarSurfaceSprite",
    "ensureStellarGlowSprite",
    "stellarGlowSprite",
    "ensureStellar02Assets",
    "waitForStellar02Assets",
    "sun_surface.png",
    "star_colorshift.png",
    "sampleStellarPalette",
    "surface02",
    "tileCanvas",
    "detailCanvas",
    "shadowCanvas",
    "flowCanvas",
    "rotationalFlow",
    "drawContinuousStellarSurfaceLayer",
    "surfaceSpinOffsetPx",
    "targetBodyLuma",
    "stellarPhase",
    "stellarSpinCycle",
    "stellarSpinSpeed",
    "stellarAxisTiltAngle",
    "stellarProjectedPose",
    "surfaceSpinPhase",
    "drawRadialStellarCorona",
    "drawLimbSparkleGlints",
    "sparkleAlpha",
    "radialCoronaAlpha",
    "drawImage",
    "activeGlowStrength",
    "activeGlowRadius",
    "stellarOpticalLeadIn",
    "settledSurfaceRetreat",
  )
  missing = [token for token in required if token not in worker_source]
  if missing:
    raise AssertionError(f"active star lost its cheap baked glow stack: {missing}")
  if "drawImage(" not in worker_source:
    raise AssertionError("active glow stack should draw a cached sprite instead of many per-frame primitives")
  forbidden_asset_tokens = (
    "corona.png",
    "sun_halo.png",
    "solarflare.png",
    "stellarProminenceSprites",
    "ensureStellarProminenceSprite",
    "stellarCoronaSpinAngle",
  )
  found_asset_tokens = [token for token in forbidden_asset_tokens if token in worker_source]
  if found_asset_tokens:
    raise AssertionError(f"active glow stack kept obsolete directional corona/flare branches: {found_asset_tokens}")
  surface_start = worker_source.find("function ensureStellarSurfaceSprite")
  surface_end = worker_source.find("function ensureStellarGlowSprite", surface_start)
  if surface_start < 0 or surface_end < 0:
    raise AssertionError("active surface atlas sprite boundary was not discoverable")
  surface_source = worker_source[surface_start:surface_end]
  forbidden_surface_tokens = ("phaseBucket", "phaseCount", "Math.floor(phase")
  found_surface_tokens = [token for token in forbidden_surface_tokens if token in surface_source]
  if found_surface_tokens:
    raise AssertionError(
      "active photosphere atlas must not advance visible self-rotation by swapping low-frequency "
      f"phase buckets: {found_surface_tokens}"
    )
  continuous_start = worker_source.find("function drawContinuousStellarSurfaceLayer")
  continuous_end = worker_source.find("function longitudinalSpinOffsetPx", continuous_start)
  if continuous_start < 0 or continuous_end < 0:
    raise AssertionError("continuous stellar surface drift boundary was not discoverable")
  continuous_source = worker_source[continuous_start:continuous_end]
  forbidden_continuous_tokens = ("clamp(spinOffsetPx", "bodySize * 0.22")
  found_continuous_tokens = [token for token in forbidden_continuous_tokens if token in continuous_source]
  if found_continuous_tokens:
    raise AssertionError(
      "visible photosphere drift must wrap as a continuous tiled atlas, not clamp at the edge and pause: "
      f"{found_continuous_tokens}"
    )
  start = worker_source.find("function ensureStellarGlowSprite")
  end = worker_source.find("function localReferenceStrength", start)
  if start < 0 or end < 0:
    raise AssertionError("active baked glow sprite boundary was not discoverable")
  sprite_source = worker_source[start:end]
  forbidden = ("createLinearGradient", "lineTo", "strokeStyle", "limbShell", "const chromosphere =")
  found = [token for token in forbidden if token in sprite_source]
  if found:
    raise AssertionError(f"active baked glow reintroduced hard line/ray artifacts: {found}")


def assert_overlay_uses_same_star_atlas_body() -> None:
  worker_source = (ROOT / "assets" / "stars-observatory-worker.js").read_text(encoding="utf-8")
  start = worker_source.find("function drawLocalAtmosphere")
  end = worker_source.find("function rectsOverlap", start)
  if start < 0 or end < 0:
    raise AssertionError("near-field overlay surface boundary was not discoverable")
  overlay_source = worker_source[start:end]
  forbidden_tokens = (
    "bodyAlpha",
    "highlightX",
    "fillRect(p.x - radius",
    "labelContext.clip();",
    "coronaCount",
    "fieldArcCount",
    "quadraticCurveTo",
    "labelContext.strokeStyle",
    "bodyRimEqualizeAlpha",
    "surfaceEdgeSealAlpha",
    "rimWash",
    "edgeAlpha",
    "photosphereLimbDimmingAlpha",
    "photosphereThermalAlpha",
    "bakedCorona",
    "prominenceAlpha",
    "stellarAssets",
    "glareAlpha",
  )
  found = [token for token in forbidden_tokens if token in overlay_source]
  if found:
    raise AssertionError(f"near-field overlay reintroduced hard reference/body artifacts: {found}")
  required = (
    "ensureStellarSurfaceSprite",
    "stellarProjectedPose",
    "longitudePhase",
    "surfaceAxisTilt",
    "surfaceViewSpinCycle",
    "photosphereAlpha",
    "rotationalFlowAlpha",
    "flowCanvas",
    "drawContinuousStellarSurfaceLayer",
    "surfaceSpinOffsetPx",
    "baseSurfaceSpinOffsetPx",
    "surfaceSpinCycle",
    "tileCanvas",
    "localSystemWhiteHotLead",
    "localSystemPreviewRadius",
    "localSystemTextureLead",
    "drawPhotosphereGranulation",
    "drawPhotosphereFilamentRidges",
    "drawPhotosphereMicrograin",
    "drawOpticalPhotosphereBody",
    "opticalPhotosphereAlpha",
    "bodyWash",
    "limbGlow",
    "localSystemAtlasDeemphasis",
    "bodyRadius",
    "ensureStellarGlowSprite",
    "drawRadialStellarCorona",
    "drawLimbSparkleGlints",
    "drawSoftPhotosphereBloom",
    "drawImage",
    "labelContext.rotate(surfaceAxisTilt",
    "activeGlowStrength",
    "sparkleAlpha",
    "radialCoronaAlpha",
    "clip(\"evenodd\")",
    "bodyRadius * 1.180",
    "const sphereBodyRadiusScale = 1",
    "bloomNoLimbPeak",
  )
  missing = [token for token in required if token not in overlay_source]
  if missing:
    raise AssertionError(f"near-field overlay lost the active-only baked photosphere/glow handoff: {missing}")
  forbidden_near_field_tokens = (
    "0.932",
    "0.175 - retreat",
  )
  found_near_field_tokens = [token for token in forbidden_near_field_tokens if token in overlay_source]
  if found_near_field_tokens:
    raise AssertionError(
      f"near-field overlay reintroduced a shrunken photosphere or a bloom peak at the visible limb: "
      f"{found_near_field_tokens}"
    )
  if "drawImage(surfaceSprite.canvas, -bodySize * 0.5" in overlay_source:
    raise AssertionError(
      "near-field main photosphere atlas is fixed on screen; the main body layer must use the same "
      "continuous longitude drift as its detail/flow layers"
    )


def assert_surface_reference_frame_retires() -> None:
  worker_source = (ROOT / "assets" / "stars-observatory-worker.js").read_text(encoding="utf-8")
  if "function drawLocalReferenceFrame" in worker_source or "drawLocalReferenceFrame(" in worker_source:
    raise AssertionError("LocalSystem/Surface must not draw long radial reference-frame geometry")
  start = worker_source.find("function localReferenceStrength")
  end = worker_source.find("function isNamedStar", start)
  if start < 0 or end < 0:
    raise AssertionError("local reference strength boundary was not discoverable")
  body = worker_source[start:end]
  if "surfaceReference" in body:
    raise AssertionError("Surface close-up must not re-enable the LocalSystem reference frame")
  start = worker_source.find("function drawReference")
  end = worker_source.find("function pickAt", start)
  if start < 0 or end < 0:
    raise AssertionError("global reference drawing boundary was not discoverable")
  reference_body = worker_source[start:end]
  required_fades = ("localSystemPresence", "localApproach", "surfacePresence")
  missing = [token for token in required_fades if token not in reference_body]
  if missing:
    raise AssertionError(f"global reference layer no longer retires before near-field Surface: {missing}")
  label_start = worker_source.find("function drawLabel")
  label_end = worker_source.find("function drawLabels", label_start)
  if label_start < 0 or label_end < 0:
    raise AssertionError("label drawing boundary was not discoverable")
  label_body = worker_source[label_start:label_end]
  label_required = ("labelLeaderAlpha", "surfaceReadiness", "smoothstep(0.68, 0.92")
  label_missing = [token for token in label_required if token not in label_body]
  if label_missing:
    raise AssertionError(
      f"close Surface active label leader must fade before it can read as a stellar edge artifact: {label_missing}"
    )


def assert_local_sky_dome_contract() -> None:
  worker_source = (ROOT / "assets" / "stars-observatory-worker.js").read_text(encoding="utf-8")
  required = (
    "ensureLocalSkyDome",
    "drawLocalSkyDome",
    "localSkyBudget",
    "localSkyCloudBudget",
    "clouds",
    "localSkyDome",
  )
  missing = [token for token in required if token not in worker_source]
  if missing:
    raise AssertionError(f"near-field backdrop lost its independent sky dome: {missing}")
  forbidden = (
    "drawBridgeRings",
    "bridgeLineFade",
    "star.spike",
    "const spike = radius",
  )
  found = [token for token in forbidden if token in worker_source]
  if found:
    raise AssertionError(f"near-field backdrop reintroduced line/spike artifacts: {found}")


def assert_metric_core_continuity(states: list[dict[str, object]]) -> None:
  map_states = [
    state
    for state in states
    if state.get("scaleStage") in {"Galactic", "Regional", "LocalMap"}
    and float(state.get("distance", 0)) >= 1500
  ]
  if not map_states:
    raise AssertionError("no map-scale states were available for core continuity checks")
  weak = [
    state
    for state in map_states
    if float(state.get("metricCoreVisibility", -1)) < 0.96
    or float(state.get("metricCoreRadiusScale", -1)) < 0.94
  ]
  if weak:
    raise AssertionError(f"map-scale LOD handoff dimmed or shrank star cores: {weak}")
  handoff_states = [
    state
    for state in map_states
    if float(state.get("metricLayerPointScale", 1)) < 0.62
    or float(state.get("metricLayerOpacity", 1)) < 0.92
  ]
  if not handoff_states:
    raise AssertionError("core continuity check did not sample a meaningful layer handoff")


def assert_bridge_handoff_continuity(states: list[dict[str, object]]) -> None:
  transition_states = [
    state
    for state in states
    if state.get("scaleStage") in {"Regional", "LocalMap"}
    and 1500 <= float(state.get("distance", 0)) <= 6500
    and float(state.get("localSystemPresence", 0)) < 0.08
  ]
  if not transition_states:
    raise AssertionError("bridge continuity check did not sample the Regional -> LocalMap handoff")
  weak = [
    state
    for state in transition_states
    if float(state.get("activeBridgePresence", state.get("bridge", 0))) < 0.16
  ]
  if weak:
    raise AssertionError(f"Regional -> LocalMap bridge left an active-neighborhood brightness gap: {weak}")
  strongest = max(float(state.get("activeBridgePresence", state.get("bridge", 0))) for state in transition_states)
  if strongest > 0.84:
    raise AssertionError(f"active bridge became a brightness spike during handoff: strength={strongest:.2f}")
  local_map_samples = [
    state
    for state in transition_states
    if state.get("scaleStage") == "LocalMap" and float(state.get("distance", 0)) >= 1500
  ]
  if local_map_samples and max(float(state.get("localMapBridgePresence", 0)) for state in local_map_samples) < 0.20:
    raise AssertionError(f"LocalMap did not expose its own active bridge handoff: {local_map_samples}")


def assert_haze_budget(state: dict[str, object], label: str, overlay_limit: float, require_no_veil: bool = True) -> None:
  veil = float(state.get("globalVeilPresence", 1))
  haze = float(state.get("overlayHazeBudget", 1))
  if require_no_veil and veil != 0:
    raise AssertionError(f"{label} should not retain global veil presence: {state}")
  if haze > overlay_limit:
    raise AssertionError(f"{label} overlay haze budget exceeded {overlay_limit}: {state}")


def assert_active_halo_ratio(state: dict[str, object], label: str, maximum: float = 2.2) -> None:
  ratio = float(state.get("activeHaloRatio", 9))
  if ratio > maximum:
    raise AssertionError(f"{label} active halo escaped local optical bounds: ratio={ratio:.2f}, state={state}")


def assert_mixed_handoff(
  states: list[dict[str, object]],
  left_key: str,
  right_key: str,
  label: str,
  floor: float = 0.08,
  ceiling: float = 0.96,
) -> None:
  for state in states:
    left = float(state.get(left_key, 0))
    right = float(state.get(right_key, 0))
    if floor <= left <= ceiling and floor <= right <= ceiling:
      return
  raise AssertionError(f"{label} did not expose a mixed handoff state")


def sample_luma(image: Image.Image, x: float, y: float, radius: int = 8) -> float:
  left = max(0, int(x) - radius)
  top = max(0, int(y) - radius)
  right = min(image.width, int(x) + radius + 1)
  bottom = min(image.height, int(y) + radius + 1)
  crop = image.convert("L").crop((left, top, right, bottom))
  return float(ImageStat.Stat(crop).mean[0])


def clarity_metrics(name: str, state: dict[str, object], crop_fraction: float = 0.32) -> tuple[float, float, float, float]:
  image = Image.open(OUT_DIR / f"{name}.png").convert("L")
  active_x = float(state.get("activeX", image.width * 0.5))
  active_y = float(state.get("activeY", image.height * 0.5))
  crop_radius = int(min(image.width, image.height) * crop_fraction)
  left = max(0, int(active_x) - crop_radius)
  top = max(120, int(active_y) - crop_radius)
  right = min(image.width, int(active_x) + crop_radius)
  bottom = min(image.height, int(active_y) + crop_radius)
  crop = image.crop((left, top, right, bottom))
  blur = crop.filter(ImageFilter.GaussianBlur(radius=2))
  high_frequency = ImageStat.Stat(ImageChops.difference(crop, blur)).mean[0]
  edge_energy = ImageStat.Stat(crop.filter(ImageFilter.FIND_EDGES)).mean[0]
  stat = ImageStat.Stat(crop)
  return float(stat.mean[0]), float(stat.stddev[0]), float(high_frequency), float(edge_energy)


def assert_clear_structure(
  name: str,
  state: dict[str, object],
  min_hf_ratio: float,
  min_edge: float,
  min_stddev: float = 3.2,
) -> None:
  mean, stddev, high_frequency, edge_energy = clarity_metrics(name, state)
  ratio = high_frequency / max(mean, 1)
  high_luma_photosphere_detail = (
    mean >= 96 and high_frequency >= 4.4 and edge_energy >= min_edge * 1.2
  )
  saturated_close_photosphere_detail = (
    mean >= 180 and stddev >= 28 and high_frequency >= 3.0 and edge_energy >= min_edge * 1.2
  )
  if (
    stddev < min_stddev
    or (
      ratio < min_hf_ratio
      and not (high_luma_photosphere_detail or saturated_close_photosphere_detail)
    )
    or edge_energy < min_edge
  ):
    raise AssertionError(
      f"{name}: LOD handoff looked dominated by low-frequency haze "
      f"(mean={mean:.2f} std={stddev:.2f} hf={high_frequency:.2f} ratio={ratio:.3f} edge={edge_energy:.2f}, state={state})"
    )


def quantile(values: list[int], fraction: float) -> float:
  if not values:
    return 0
  ordered = sorted(values)
  index = min(len(ordered) - 1, max(0, int(round((len(ordered) - 1) * fraction))))
  return float(ordered[index])


def background_luminance_metrics(name: str, state: dict[str, object] | None = None) -> tuple[float, float]:
  image = Image.open(OUT_DIR / f"{name}.png").convert("L")
  width, height = image.size
  top = min(height - 1, 120)
  active_x = float(state.get("activeX", width * 0.5)) if state is not None else 0.0
  active_y = float(state.get("activeY", height * 0.5)) if state is not None else 0.0
  exclusion_radius = active_optical_exclusion_radius(state, min(width, height)) if state is not None else 0.0
  boxes = [
    (0, top, int(width * 0.24), height),
    (int(width * 0.76), top, width, height),
    (int(width * 0.24), top, int(width * 0.76), int(height * 0.36)),
    (int(width * 0.24), int(height * 0.74), int(width * 0.76), height),
  ]
  values: list[int] = []
  for box in boxes:
    left, upper, right, lower = box
    if right <= left or lower <= upper:
      continue
    if exclusion_radius > 0:
      for y in range(upper, lower, 2):
        for x in range(left, right, 2):
          if math.hypot(x - active_x, y - active_y) >= exclusion_radius:
            values.append(image.getpixel((x, y)))
    else:
      values.extend(image.crop(box).getdata())
  if not values:
    raise AssertionError(f"{name}: no background pixels available for luminance continuity")
  trimmed_low = quantile(values, 0.10)
  trimmed_high = quantile(values, 0.90)
  trimmed = [value for value in values if trimmed_low <= value <= trimmed_high]
  mean = sum(trimmed) / max(1, len(trimmed))
  return float(mean), quantile(values, 0.85)


def trimmed_luminance_mean(values: list[int]) -> float:
  if not values:
    return 0
  low = quantile(values, 0.10)
  high = quantile(values, 0.90)
  trimmed = [value for value in values if low <= value <= high]
  return float(sum(trimmed) / max(1, len(trimmed)))


def active_optical_exclusion_radius(state: dict[str, object], min_dimension: float = 900) -> float:
  sphere_radius = float(state.get("sphereScreenRadius", state.get("surfaceRadius", 0)))
  glow_radius = float(state.get("activeGlowRadius", 0))
  glow_strength = float(state.get("activeGlowStrength", 0))
  glow_multiplier = 1.85 if glow_strength >= 0.08 else 1.16
  local_system_presence = float(state.get("localSystemPresence", 0))
  surface_readiness = float(state.get("surfaceReadiness", 0))
  shell_radius = 0.0
  if local_system_presence >= 0.08 and surface_readiness < 0.38:
    shell_radius = min_dimension * (0.20 + (0.42 - 0.20) * local_system_presence) * 1.34
  return max(sphere_radius * 1.16, glow_radius * glow_multiplier, shell_radius)


def surface_luminance_metrics(
  name: str,
  state: dict[str, object],
  exclusion_radius: float | None = None,
) -> tuple[float, float, float]:
  image = Image.open(OUT_DIR / f"{name}.png").convert("L")
  width, height = image.size
  active_x = float(state.get("activeX", width * 0.5))
  active_y = float(state.get("activeY", height * 0.5))
  active_exclusion_radius = (
    exclusion_radius
    if exclusion_radius is not None
    else active_optical_exclusion_radius(state, min(width, height))
  )
  full: list[int] = []
  for y in range(min(height - 1, 120), height, 2):
    for x in range(0, width, 2):
      if active_exclusion_radius > 0 and math.hypot(x - active_x, y - active_y) < active_exclusion_radius:
        continue
      full.append(image.getpixel((x, y)))
  if not full:
    full = list(image.crop((0, min(height - 1, 120), width, height)).getdata())
  background_mean = local_backdrop_metrics(name, state, active_exclusion_radius)["mean"]
  sphere_radius = float(state.get("sphereScreenRadius", state.get("surfaceRadius", 60)))
  sphere_visible = float(state.get("sphereVisibility", 0)) > 0.25
  crop_radius = (
    max(28, min(220, sphere_radius * 0.72))
    if sphere_visible
    else max(110, min(260, sphere_radius * 0.88))
  )
  left = max(0, int(active_x - crop_radius))
  top = max(120, int(active_y - crop_radius))
  right = min(width, int(active_x + crop_radius))
  bottom = min(height, int(active_y + crop_radius))
  center = list(image.crop((left, top, right, bottom)).getdata())
  return trimmed_luminance_mean(full), background_mean, trimmed_luminance_mean(center)


def webgpu_sphere_pixels_unavailable(name: str, state: dict[str, object]) -> bool:
  if int(state.get("sphereDraw", 0)) != 1 or float(state.get("sphereVisibility", 0)) <= 0.25:
    return False
  image_rgb = Image.open(OUT_DIR / f"{name}.png").convert("RGB")
  image = image_rgb.convert("L")
  radius = float(state.get("sphereScreenRadius", state.get("surfaceRadius", 0)))
  if radius < 70:
    return False
  active_x = float(state.get("activeX", image.width * 0.5))
  active_y = float(state.get("activeY", image.height * 0.5))
  crop_radius = int(min(radius * 0.82, min(image.width, image.height) * 0.42))
  left = max(0, int(active_x) - crop_radius)
  top = max(0, int(active_y) - crop_radius)
  right = min(image.width, int(active_x) + crop_radius)
  bottom = min(image.height, int(active_y) + crop_radius)
  crop = image.crop((left, top, right, bottom))
  stat = ImageStat.Stat(crop)
  center_radius = int(min(radius * 0.36, min(image.width, image.height) * 0.24))
  center_left = max(0, int(active_x) - center_radius)
  center_top = max(120, int(active_y) - center_radius)
  center_right = min(image.width, int(active_x) + center_radius)
  center_bottom = min(image.height, int(active_y) + center_radius)
  center_luma = image.crop((center_left, center_top, center_right, center_bottom))
  center_rgb = image_rgb.crop((center_left, center_top, center_right, center_bottom))
  center_luma_stat = ImageStat.Stat(center_luma)
  center_rgb_stat = ImageStat.Stat(center_rgb)
  central_smooth_cool_void = (
    center_luma_stat.mean[0] < 42
    and center_luma_stat.stddev[0] < 5.0
    and center_rgb_stat.mean[2] > center_rgb_stat.mean[0] + 6.0
  )
  central_overlay_void = (
    stat.mean[0] > 24
    and center_luma_stat.mean[0] < max(42, stat.mean[0] * 0.72)
    and center_luma_stat.stddev[0] < 8.5
  )
  muted_overlay_only = (
    float(state.get("activeGlowStrength", 0)) > 0.45
    and stat.mean[0] < 78
    and center_luma_stat.mean[0] < 78
    and stat.stddev[0] > 12
  )
  return (
    stat.mean[0] < 18
    or stat.stddev[0] < 7.5
    or central_smooth_cool_void
    or central_overlay_void
    or muted_overlay_only
  )


def map_star_optical_metrics(name: str) -> dict[str, float]:
  image = Image.open(OUT_DIR / f"{name}.png").convert("L")
  width, height = image.size
  left = int(width * 0.30)
  top = max(120, int(height * 0.22))
  right = int(width * 0.70)
  bottom = int(height * 0.78)
  values = list(image.crop((left, top, right, bottom)).getdata())
  if not values:
    raise AssertionError(f"{name}: no map-star pixels available for optical continuity")
  return {
    "bright16": float(sum(value >= 16 for value in values)),
    "bright24": float(sum(value >= 24 for value in values)),
    "mass16": float(sum(max(0, value - 16) for value in values) / len(values)),
    "p95": quantile(values, 0.95),
  }


def dynamic_map_luminance_metrics(png: bytes) -> dict[str, float]:
  image = Image.open(io.BytesIO(png)).convert("L")
  width, height = image.size
  left = int(width * 0.18)
  top = max(120, int(height * 0.30))
  right = int(width * 0.82)
  bottom = int(height * 0.70)
  values = list(image.crop((left, top, right, bottom)).getdata())
  if not values:
    raise AssertionError("continuous wheel frame had no luminance pixels")
  return {
    "mean": float(sum(values) / len(values)),
    "mass16": float(sum(max(0, value - 16) for value in values) / len(values)),
    "p95": quantile(values, 0.95),
  }


def assert_continuous_wheel_luminance_stability(browser, url: str) -> None:
  page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
  frames: list[tuple[int, dict[str, object], dict[str, float]]] = []
  try:
    page.goto(url, wait_until="networkidle", timeout=60000)
    wait_for_observatory(page)
    page.mouse.move(720, 450)
    page.wait_for_timeout(900)
    for step in range(28):
      if step < 22:
        send_wheel(page, -180)
      page.wait_for_timeout(86)
      state = debug_state(page)
      png = page.screenshot(path=str(OUT_DIR / f"dynamic-wheel-{step:02d}.png"))
      distance = float(state.get("distance", 80000))
      if state.get("lod") in {"Galactic", "Regional"} and 2600 <= distance <= 52000:
        frames.append((step, state, dynamic_map_luminance_metrics(png)))
  finally:
    page.close()

  if len(frames) < 8:
    raise AssertionError(f"continuous wheel stability check did not sample the map handoff: {frames}")

  for (left_step, left_state, left), (right_step, right_state, right) in zip(frames, frames[1:]):
    mass_delta = abs(right["mass16"] - left["mass16"])
    mean_delta = abs(right["mean"] - left["mean"])
    p95_delta = abs(right["p95"] - left["p95"])
    mass_limit = max(1.18, min(left["mass16"], right["mass16"]) * 0.72)
    if left_state.get("lod") != right_state.get("lod"):
      mass_limit = max(mass_limit, 1.15)
    if mass_delta > mass_limit or mean_delta > 1.25 or p95_delta > 8:
      raise AssertionError(
        "continuous wheel zoom produced a frame-to-frame luminance flicker "
        f"between frames {left_step} and {right_step}: "
        f"{left} -> {right}, states={left_state} -> {right_state}"
      )


def assert_surface_luminance_anchoring(named_states: list[tuple[str, dict[str, object]]]) -> None:
  shared_exclusion_radius = max(
    active_optical_exclusion_radius(state)
    for _, state in named_states
  )
  metrics = [
    (name, *surface_luminance_metrics(name, state, shared_exclusion_radius))
    for name, state in named_states
  ]
  state_by_name = dict(named_states)
  if len(metrics) < 2:
    return
  missing_sphere_pixels = {
    name for name, state in named_states
    if float(state.get("sphereVisibility", 0)) <= 0.25 or webgpu_sphere_pixels_unavailable(name, state)
  }
  full_values = [full for _, full, _, _ in metrics]
  background_values = [background for _, _, background, _ in metrics]
  if max(full_values) - min(full_values) > 3.0:
    raise AssertionError(f"Surface handoff changed full-frame luminance too much: {metrics}")
  if max(background_values) - min(background_values) > 1.6:
    raise AssertionError(f"Surface handoff changed background luminance too much: {metrics}")
  for (left_name, left_full, left_bg, left_center), (right_name, right_full, right_bg, right_center) in zip(metrics, metrics[1:]):
    surface_depth = max(
      float(state_by_name.get(left_name, {}).get("surfaceDepth", 0)),
      float(state_by_name.get(right_name, {}).get("surfaceDepth", 0)),
    )
    background_limit = 0.90 + surface_depth * 1.20
    if abs(right_full - left_full) > 1.60 or abs(right_bg - left_bg) > background_limit:
      raise AssertionError(
        f"Surface handoff luminance jumped between {left_name} and {right_name}: {metrics}"
      )
    if left_name in missing_sphere_pixels or right_name in missing_sphere_pixels:
      print(
        f"{left_name}->{right_name}: skipped Surface center-luminance anchoring because "
        "this Chromium mode did not expose the WebGPU sphere layer."
      )
      continue
    radius_growth = sphere_radius(state_by_name[right_name]) / max(sphere_radius(state_by_name[left_name]), 1.0)
    left_phase = float(state_by_name.get(left_name, {}).get("surfaceSpinPhase", 0))
    right_phase = float(state_by_name.get(right_name, {}).get("surfaceSpinPhase", left_phase))
    phase_delta = abs(right_phase - left_phase)
    phase_delta = min(phase_delta, 1 - phase_delta)
    allowed_center_rise = 6.0 + max(0.0, radius_growth - 1.0) * 46.0
    allowed_center_drop = 8.0 + phase_delta * 1200.0 + surface_depth * 28.0
    if right_center < 170.0 or right_center < left_center - allowed_center_drop or right_center > left_center + allowed_center_rise:
      raise AssertionError(
        f"Surface subject luminance was not anchored between {left_name} and {right_name}: {metrics}"
      )


def assert_active_luminance_continuity(named_states: list[tuple[str, dict[str, object]]]) -> None:
  metrics = [(name, *surface_luminance_metrics(name, state)) for name, state in named_states]
  if len(metrics) < 2:
    return
  for (left_name, _, _, left_center), (right_name, _, _, right_center) in zip(metrics, metrics[1:]):
    allowed_drop = 3.2 if min(left_center, right_center) > 38.0 else 1.8
    if right_center < left_center - allowed_drop:
      raise AssertionError(
        "Active target luminance dipped during LocalMap -> LocalSystem handoff "
        f"between {left_name} and {right_name}: {metrics}"
      )


def assert_galactic_regional_luminance_continuity(
  named_states: list[tuple[str, dict[str, object]]]
) -> None:
  metrics = [(name, *surface_luminance_metrics(name, state)) for name, state in named_states]
  if len(metrics) < 3:
    return
  for (left_name, left_full, _, left_center), (right_name, right_full, _, right_center) in zip(metrics, metrics[1:]):
    if right_center < left_center - 1.2 or right_full < left_full - 0.75:
      raise AssertionError(
        "Galactic -> Regional handoff created a visible luminance dip "
        f"between {left_name} and {right_name}: {metrics}"
      )
  veil_values = [(name, float(state.get("globalVeilPresence", 0))) for name, state in named_states]
  exposure_values = [(name, float(state.get("exposure", 0))) for name, state in named_states]
  for (left_name, left), (right_name, right) in zip(veil_values, veil_values[1:]):
    if left - right > 0.085:
      raise AssertionError(
        f"Galactic veil retreated too abruptly between {left_name} and {right_name}: {veil_values}"
      )
  for (left_name, left), (right_name, right) in zip(exposure_values, exposure_values[1:]):
    if abs(right - left) > 0.025:
      raise AssertionError(
        f"Galactic -> Regional exposure changed too much between {left_name} and {right_name}: {exposure_values}"
      )


def assert_galactic_regional_optical_continuity(
  named_states: list[tuple[str, dict[str, object]]]
) -> None:
  metrics = [(name, map_star_optical_metrics(name)) for name, _ in named_states]
  states = {name: state for name, state in named_states}
  if len(metrics) < 3:
    return
  baseline_name, baseline = metrics[0]
  for name, metric in metrics[1:]:
    if (
      metric["bright16"] < baseline["bright16"] * 0.76
      or metric["bright24"] < baseline["bright24"] * 0.68
      or metric["mass16"] < baseline["mass16"] * 0.78
      or (
        metric["p95"] < baseline["p95"] - 2.5
        and metric["bright16"] < baseline["bright16"] * 0.86
      )
    ):
      raise AssertionError(
        "Galactic -> Regional handoff collapsed star PSF/halo area "
        f"from {baseline_name} to {name}: {metrics}"
      )
    label_heavy = float(states.get(name, {}).get("labels", 0)) > 12
    if (
      not label_heavy
      and (metric["mass16"] > baseline["mass16"] * 1.24 + 0.12 or metric["p95"] > baseline["p95"] + 6.5)
    ):
      raise AssertionError(
        "Galactic -> Regional handoff created a short over-bright optical peak "
        f"from {baseline_name} to {name}: {metrics}"
      )
  debug_values = [
    (name, float(state.get("metricLayerHaloScale", 0)), float(state.get("metricPsfContinuity", 0)))
    for name, state in named_states
  ]
  for name, halo, psf in debug_values[1:]:
    if halo < 0.38 or psf < 0.32:
      raise AssertionError(
        f"{name} lost map-scale PSF continuity during Galactic -> Regional handoff: {debug_values}"
      )


def assert_exposure_continuity(named_states: list[tuple[str, dict[str, object]]]) -> None:
  values = [(name, float(state.get("exposure", -1))) for name, state in named_states]
  if any(value < 0 for _, value in values):
    raise AssertionError(f"LOD states did not expose exposure for continuity checks: {values}")
  minimum = min(value for _, value in values)
  maximum = max(value for _, value in values)
  if maximum - minimum > 0.075:
    raise AssertionError(f"LOD handoff used global exposure as a stage cue: {values}")
  for (left_name, left), (right_name, right) in zip(values, values[1:]):
    if abs(right - left) > 0.050:
      raise AssertionError(
        f"adjacent LOD exposure jumped too much between {left_name} and {right_name}: {values}"
      )


def assert_background_luminance_continuity(
  items: list[str] | list[tuple[str, dict[str, object]]]
) -> None:
  normalized = [
    item if isinstance(item, tuple) else (item, None)
    for item in items
  ]
  metrics = [(name, *background_luminance_metrics(name, state)) for name, state in normalized]
  for (left_name, left_mean, left_p85), (right_name, right_mean, right_p85) in zip(metrics, metrics[1:]):
    mean_delta = abs(right_mean - left_mean)
    p85_delta = abs(right_p85 - left_p85)
    if mean_delta > 8.0 or p85_delta > 18.0:
      raise AssertionError(
        "LOD handoff changed background luminance too abruptly "
        f"between {left_name} and {right_name}: {metrics}"
      )


def headless_captured_webgpu_scene() -> bool:
  image_path = OUT_DIR / "galactic.png"
  if not image_path.exists():
    return False
  image = Image.open(image_path).convert("L")
  width, height = image.size
  boxes = [
    (0, 120, width // 4, height),
    (3 * width // 4, 120, width, height),
    (0, 120, width, height // 3),
    (0, 2 * height // 3, width, height),
  ]
  bright_outer_pixels = 0
  for box in boxes:
    bright_outer_pixels += sum(value > 90 for value in image.crop(box).getdata())
  return bright_outer_pixels > 6000


def assert_sphere_pixels(name: str, state: dict[str, object]) -> None:
  if not headless_captured_webgpu_scene():
    print(
      f"{name}: headless Chromium did not expose the WebGPU scene layer; "
      "sphere visibility is checked through debug state and desktop/manual capture."
    )
    return
  radius = float(state.get("sphereScreenRadius", 0))
  if radius < 70:
    raise AssertionError(f"sphere pixel check needs a visible sphere radius: {state}")
  active_x = float(state.get("activeX", -1000))
  active_y = float(state.get("activeY", -1000))
  image = Image.open(OUT_DIR / f"{name}.png").convert("RGB")
  crop_radius = int(min(radius * 0.82, min(image.width, image.height) * 0.42))
  left = max(0, int(active_x) - crop_radius)
  top = max(0, int(active_y) - crop_radius)
  right = min(image.width, int(active_x) + crop_radius)
  bottom = min(image.height, int(active_y) + crop_radius)
  crop = image.crop((left, top, right, bottom)).convert("L")
  stat = ImageStat.Stat(crop)
  if webgpu_sphere_pixels_unavailable(name, state):
    print(
      f"{name}: screenshot exposed only the overlay rim/background in this Chromium mode; "
      "sphere material is checked by debug state, shader contract, and headed/manual capture."
    )
    return
  if stat.mean[0] < 12 or stat.stddev[0] < 7.5:
    if webgpu_sphere_pixels_unavailable(name, state):
      print(
        f"{name}: screenshot did not expose the WebGPU sphere layer in this Chromium mode; "
        "sphere material is checked by debug state, shader contract, and headed/manual capture."
      )
      return
    raise AssertionError(
      f"{name}: visible WebGPU scene did not contain enough sphere pixels "
      f"(mean={stat.mean[0]:.2f} std={stat.stddev[0]:.2f}, state={state})"
    )
  highlight = sample_luma(image, active_x - radius * 0.18, active_y - radius * 0.22, 10)
  limb = sample_luma(image, active_x + radius * 0.58, active_y + radius * 0.28, 10)
  gradient_delta = abs(highlight - limb)
  rgb_crop = image.crop((left, top, right, bottom))
  low_frequency_luma = rgb_crop.filter(ImageFilter.GaussianBlur(radius=24)).convert("L")
  rgb_values: list[tuple[int, int, int]] = []
  luma_values: list[int] = []
  low_frequency_values: list[int] = []
  mask_radius = radius * 0.72
  terrain_mask_radius = radius * 0.58
  for y in range(max(120, top), bottom, 2):
    for x in range(left, right, 2):
      distance_from_center = math.hypot(x - active_x, y - active_y)
      if distance_from_center > mask_radius:
        continue
      red, green, blue = image.getpixel((x, y))
      rgb_values.append((red, green, blue))
      luma_values.append(int(red * 0.2126 + green * 0.7152 + blue * 0.0722))
      if distance_from_center <= terrain_mask_radius:
        low_frequency_values.append(low_frequency_luma.getpixel((x - left, y - top)))
  if len(rgb_values) < 1200:
    raise AssertionError(f"{name}: sphere material check could not sample enough body pixels: {state}")
  if len(low_frequency_values) < 700:
    raise AssertionError(f"{name}: sphere terrain check could not sample enough inner-body pixels: {state}")
  r_mean = sum(red for red, _, _ in rgb_values) / len(rgb_values)
  g_mean = sum(green for _, green, _ in rgb_values) / len(rgb_values)
  b_mean = sum(blue for _, _, blue in rgb_values) / len(rgb_values)
  luma_mean = sum(luma_values) / len(luma_values)
  luma_std = math.sqrt(sum((value - luma_mean) ** 2 for value in luma_values) / len(luma_values))
  low_frequency_mean = sum(low_frequency_values) / len(low_frequency_values)
  low_frequency_std = math.sqrt(sum((value - low_frequency_mean) ** 2 for value in low_frequency_values) / len(low_frequency_values))
  dark_ratio = sum(value < max(16, luma_mean * 0.54) for value in luma_values) / len(luma_values)
  high_frequency = ImageStat.Stat(ImageChops.difference(rgb_crop, rgb_crop.filter(ImageFilter.GaussianBlur(radius=1.8))).convert("L")).mean[0]
  if r_mean < b_mean + 2.0 or r_mean < g_mean - 10.0:
    raise AssertionError(
      f"{name}: default Sol surface read too cool for a solar-type star "
      f"(rgb=({r_mean:.1f}, {g_mean:.1f}, {b_mean:.1f}), state={state})"
    )
  if g_mean / max(r_mean, 1.0) < 0.78 or b_mean / max(r_mean, 1.0) < 0.54:
    raise AssertionError(
      f"{name}: default Sol surface read too brown/orange instead of yellow-white photosphere "
      f"(rgb=({r_mean:.1f}, {g_mean:.1f}, {b_mean:.1f}), state={state})"
    )
  if low_frequency_std / max(luma_mean, 1.0) > 0.030:
    raise AssertionError(
      f"{name}: sphere material contained large low-frequency patches that read like terrain "
      f"(low_freq_std={low_frequency_std:.2f}, luma_mean={luma_mean:.2f}, state={state})"
    )
  if luma_mean < 150:
    raise AssertionError(
      f"{name}: photosphere optical body did not dominate the surface texture "
      f"(luma_mean={luma_mean:.2f}, state={state})"
    )
  if dark_ratio > 0.18:
    raise AssertionError(
      f"{name}: sphere material had too much low-frequency dark terrain for an emissive stellar photosphere "
      f"(dark_ratio={dark_ratio:.3f}, luma_mean={luma_mean:.2f}, state={state})"
    )
  white_hot_textured_body = (
    luma_mean > 135 and luma_std >= 6.5 and high_frequency >= 2.0
  )
  optical_dominant_body = (
    luma_mean > 190
    and luma_std >= 6.0
    and high_frequency >= 3.0
    and dark_ratio <= 0.18
  )
  high_frequency_self_lit_body = (
    luma_mean > 150 and luma_std >= 6.0 and high_frequency >= 3.2
  )
  if gradient_delta < 5.0 and not (high_frequency_self_lit_body or optical_dominant_body):
    if webgpu_sphere_pixels_unavailable(name, state):
      print(
        f"{name}: screenshot exposed only the overlay rim/background in this Chromium mode; "
        "sphere material is checked by debug state, shader contract, and headed/manual capture."
      )
      return
    raise AssertionError(
      f"{name}: visible sphere lacked readable emissive body contrast "
      f"(highlight={highlight:.2f} limb={limb:.2f} luma_std={luma_std:.2f} hf={high_frequency:.2f}, state={state})"
    )
  if gradient_delta < 7.0 and not (white_hot_textured_body or high_frequency_self_lit_body or optical_dominant_body):
    if webgpu_sphere_pixels_unavailable(name, state):
      print(
        f"{name}: screenshot exposed only the overlay rim/background in this Chromium mode; "
        "sphere material is checked by debug state, shader contract, and headed/manual capture."
      )
      return
    raise AssertionError(
      f"{name}: visible sphere lacked readable emissive body contrast "
      f"(highlight={highlight:.2f} limb={limb:.2f} luma_std={luma_std:.2f} hf={high_frequency:.2f}, state={state})"
    )
  if (luma_std < 10.0 or high_frequency < 0.78) and not (white_hot_textured_body or optical_dominant_body):
    raise AssertionError(
      f"{name}: sphere material looked too smooth/plastic "
      f"(luma_std={luma_std:.2f} hf={high_frequency:.2f}, state={state})"
    )


def annulus_luminance_values(
  image: Image.Image,
  active_x: float,
  active_y: float,
  radius: float,
  inner: float,
  outer: float,
) -> list[int]:
  values: list[int] = []
  left = max(0, int(active_x - radius * outer))
  top = max(120, int(active_y - radius * outer))
  right = min(image.width, int(active_x + radius * outer))
  bottom = min(image.height, int(active_y + radius * outer))
  for y in range(top, bottom, 2):
    for x in range(left, right, 2):
      normalized = math.hypot(x - active_x, y - active_y) / max(radius, 1.0)
      if inner <= normalized < outer:
        values.append(image.getpixel((x, y)))
  return values


def annulus_quantile(
  image: Image.Image,
  active_x: float,
  active_y: float,
  radius: float,
  inner: float,
  outer: float,
  fraction: float,
) -> float:
  return quantile(annulus_luminance_values(image, active_x, active_y, radius, inner, outer), fraction)


def estimated_visible_photosphere_radius(
  image: Image.Image,
  active_x: float,
  active_y: float,
  debug_radius: float,
) -> float:
  body_p50 = annulus_quantile(image, active_x, active_y, debug_radius, 0.42, 0.72, 0.50)
  threshold = max(70.0, body_p50 * 0.48)
  visible_ratio = 1.0
  for step in range(76, 108):
    inner = step / 100
    outer = (step + 2) / 100
    p50 = annulus_quantile(image, active_x, active_y, debug_radius, inner, outer, 0.50)
    if p50 >= threshold:
      visible_ratio = outer
  return debug_radius * min(1.12, max(0.78, visible_ratio))


def assert_no_surface_contour_shell(name: str, state: dict[str, object]) -> None:
  if not headless_captured_webgpu_scene():
    return
  if webgpu_sphere_pixels_unavailable(name, state):
    return
  debug_radius = float(state.get("sphereScreenRadius", state.get("surfaceRadius", 0)))
  if debug_radius < 86:
    return
  active_x = float(state.get("activeX", -1000))
  active_y = float(state.get("activeY", -1000))
  image = Image.open(OUT_DIR / f"{name}.png").convert("L")
  radius = estimated_visible_photosphere_radius(image, active_x, active_y, debug_radius)
  body_p50 = annulus_quantile(image, active_x, active_y, radius, 0.76, 0.94, 0.50)
  body_p75 = annulus_quantile(image, active_x, active_y, radius, 0.50, 0.82, 0.75)
  inner_limb_p50 = annulus_quantile(image, active_x, active_y, radius, 0.94, 0.99, 0.50)
  inner_limb_p75 = annulus_quantile(image, active_x, active_y, radius, 0.91, 0.99, 0.75)
  near_outer_p90 = annulus_quantile(image, active_x, active_y, radius, 1.01, 1.08, 0.90)
  mid_outer_p90 = annulus_quantile(image, active_x, active_y, radius, 1.10, 1.24, 0.90)
  far_outer_p90 = annulus_quantile(image, active_x, active_y, radius, 1.24, 1.44, 0.90)
  outer_medians = [
    annulus_quantile(image, active_x, active_y, radius, inner, outer, 0.50)
    for inner, outer in ((1.02, 1.12), (1.12, 1.28), (1.28, 1.52), (1.52, 1.84), (1.84, 2.18))
  ]
  if body_p50 <= 0 or mid_outer_p90 <= 0:
    return
  contour_ceiling = max(mid_outer_p90 * 2.45, mid_outer_p90 + 58.0, far_outer_p90 * 2.85)
  if near_outer_p90 > contour_ceiling:
    raise AssertionError(
      f"{name}: surface glow formed a tight contour shell instead of broad corona "
      f"(body_p50={body_p50:.2f} inner_limb_p50={inner_limb_p50:.2f} "
      f"near_p90={near_outer_p90:.2f} mid_p90={mid_outer_p90:.2f} "
      f"far_p90={far_outer_p90:.2f}, state={state})"
    )
  if inner_limb_p50 < body_p50 * 0.55:
    raise AssertionError(
      f"{name}: photosphere developed a dark inner contour before the corona "
      f"(body_p50={body_p50:.2f} inner_limb_p50={inner_limb_p50:.2f} "
      f"near_p90={near_outer_p90:.2f}, state={state})"
    )
  if inner_limb_p75 > max(body_p75 + 44.0, body_p75 * 1.28):
    raise AssertionError(
      f"{name}: photosphere developed a bright hard limb ring instead of a soft stellar edge "
      f"(body_p75={body_p75:.2f} inner_limb_p75={inner_limb_p75:.2f} "
      f"near_p90={near_outer_p90:.2f}, state={state})"
    )
  for left, right in zip(outer_medians, outer_medians[1:]):
    if right > max(left * 1.18, left + 4.5):
      raise AssertionError(
        f"{name}: corona luminance increased outward and formed a layered reflection shell "
        f"(outer_medians={[round(value, 2) for value in outer_medians]}, state={state})"
      )
  if max(outer_medians[1:]) > max(outer_medians[0] * 1.22, outer_medians[-1] + 8.0):
    raise AssertionError(
      f"{name}: corona contained a detached bright band instead of a smooth falloff "
      f"(outer_medians={[round(value, 2) for value in outer_medians]}, state={state})"
    )


def assert_local_system_pixels(name: str, state: dict[str, object]) -> None:
  image = Image.open(OUT_DIR / f"{name}.png").convert("RGB")
  active_x = float(state.get("activeX", image.width * 0.5))
  active_y = float(state.get("activeY", image.height * 0.5))
  crop_radius = int(min(image.width, image.height) * 0.32)
  left = max(0, int(active_x) - crop_radius)
  top = max(140, int(active_y) - crop_radius)
  right = min(image.width, int(active_x) + crop_radius)
  bottom = min(image.height, int(active_y) + crop_radius)
  crop = image.crop((left, top, right, bottom)).convert("L")
  stat = ImageStat.Stat(crop)
  extrema = crop.getextrema()
  if stat.mean[0] < 4.2 or stat.stddev[0] < 3.2 or extrema[1] < 20:
    raise AssertionError(
      f"{name}: LocalSystem bridge looked too empty "
      f"(mean={stat.mean[0]:.2f} std={stat.stddev[0]:.2f} max={extrema[1]}, state={state})"
    )
  assert_clear_structure(name, state, min_hf_ratio=0.10, min_edge=3.6, min_stddev=3.2)


def assert_local_system_preview_pixels(name: str, state: dict[str, object]) -> None:
  image = Image.open(OUT_DIR / f"{name}.png").convert("L")
  active_x = float(state.get("activeX", image.width * 0.5))
  active_y = float(state.get("activeY", image.height * 0.5))
  sample_radius = int(min(image.width, image.height) * 0.24)
  left = max(0, int(active_x) - sample_radius)
  top = max(130, int(active_y) - sample_radius)
  right = min(image.width, int(active_x) + sample_radius)
  bottom = min(image.height, int(active_y) + sample_radius)
  crop = image.crop((left, top, right, bottom))
  values = list(crop.getdata())
  if not values:
    raise AssertionError(f"{name}: no LocalSystem preview pixels available")
  bright_threshold = max(54, quantile(values, 0.92))
  bright_distances: list[float] = []
  for y in range(top, bottom, 2):
    for x in range(left, right, 2):
      if image.getpixel((x, y)) >= bright_threshold:
        bright_distances.append(math.hypot(x - active_x, y - active_y))
  if not bright_distances:
    raise AssertionError(f"{name}: LocalSystem preview had no bright stellar body pixels: {state}")
  radial_p82 = quantile(bright_distances, 0.82)
  stat = ImageStat.Stat(crop)
  if radial_p82 < 58 or stat.stddev[0] < 5.2:
    raise AssertionError(
      f"{name}: LocalSystem preview still looked like a small static light ball "
      f"(radial_p82={radial_p82:.1f}, std={stat.stddev[0]:.2f}, state={state})"
    )


def local_backdrop_metrics(
  name: str,
  state: dict[str, object],
  exclusion_radius: float | None = None,
) -> dict[str, float]:
  image = Image.open(OUT_DIR / f"{name}.png").convert("L")
  width, height = image.size
  active_x = float(state.get("activeX", width * 0.5))
  active_y = float(state.get("activeY", height * 0.5))
  radius = (
    exclusion_radius
    if exclusion_radius is not None
    else active_optical_exclusion_radius(state, min(width, height))
  )
  boxes = [
    (0, 120, int(width * 0.24), height),
    (int(width * 0.76), 120, width, height),
    (int(width * 0.24), 120, int(width * 0.76), int(height * 0.36)),
    (int(width * 0.24), int(height * 0.74), int(width * 0.76), height),
  ]
  values: list[int] = []
  for left, top, right, bottom in boxes:
    for y in range(top, bottom, 2):
      for x in range(left, right, 2):
        if radius > 0 and math.hypot(x - active_x, y - active_y) < radius:
          continue
        values.append(image.getpixel((x, y)))
  if not values:
    raise AssertionError(f"{name}: no local backdrop pixels available")
  mean = sum(values) / len(values)
  variance = sum((value - mean) ** 2 for value in values) / len(values)
  return {
    "mean": float(mean),
    "stddev": math.sqrt(variance),
    "p95": quantile(values, 0.95),
    "p99": quantile(values, 0.99),
    "bright14_ratio": sum(value >= 14 for value in values) / len(values),
    "bright22_ratio": sum(value >= 22 for value in values) / len(values),
  }


def assert_local_backdrop_pixels(name: str, state: dict[str, object]) -> None:
  metrics = local_backdrop_metrics(name, state)
  if metrics["p95"] < 10.0 or metrics["p99"] < 24.0 or metrics["bright14_ratio"] < 0.016:
    raise AssertionError(
      f"{name}: near-field backdrop looked too empty "
      f"(metrics={metrics}, state={state})"
    )
  if metrics["stddev"] < 2.9 and metrics["bright22_ratio"] < 0.0024:
    raise AssertionError(
      f"{name}: near-field backdrop lacked stellar point variation "
      f"(metrics={metrics}, state={state})"
    )


def click_active_target(page, state: dict[str, object]) -> None:
  active_x = float(state.get("activeX", -1000))
  active_y = float(state.get("activeY", -1000))
  if not (0 <= active_x <= 1440 and 0 <= active_y <= 900):
    raise AssertionError(f"active target was not click-addressable: {state}")
  page.mouse.click(active_x, active_y)
  page.wait_for_timeout(620)
  if float(debug_state(page).get("approach", 0)) >= 0.1:
    return
  label_x = min(1434, active_x + (44 if active_x < 1036 else -44))
  label_y = max(8, active_y - 18)
  page.mouse.click(label_x, label_y)


def main() -> int:
  assert_no_global_blur_filter()
  assert_star_core_not_layer_faded()
  assert_sphere_shader_material_contract()
  assert_active_baked_glow_contract()
  assert_overlay_uses_same_star_atlas_body()
  assert_surface_reference_frame_retires()
  assert_local_sky_dome_contract()
  shutil.rmtree(OUT_DIR, ignore_errors=True)
  OUT_DIR.mkdir(parents=True, exist_ok=True)
  port = free_port()
  server = start_server(port)
  browser = None
  try:
    with sync_playwright() as playwright:
      browser = playwright.chromium.launch(
        headless=True,
        args=[
          "--enable-unsafe-webgpu",
          "--enable-webgpu",
          "--ignore-gpu-blocklist",
          "--disable-dev-shm-usage",
        ],
      )
      page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
      url = f"http://127.0.0.1:{port}/?debug=1&seed=728281&catalog=10000"
      assert_continuous_wheel_luminance_stability(browser, url)
      page.goto(url, wait_until="networkidle", timeout=60000)
      wait_for_observatory(page)

      page.mouse.move(720, 450)
      galactic_state = capture(page, "galactic")
      if galactic_state.get("active") != "Sol":
        raise AssertionError(f"default focus should start on Sol: {galactic_state}")
      if not (0 <= float(galactic_state.get("activeX", -1000)) <= 1440):
        raise AssertionError(f"default Sol focus was not screen-addressable: {galactic_state}")
      assert_axis_range(galactic_state, 0.00, 0.20, "Galactic")
      wheel_follow_state = assert_wheel_targets_before_camera(page, galactic_state)
      states = [galactic_state, wheel_follow_state]
      wheel_until_metric_at_most(
        page,
        "galacticLayerHaloScale",
        0.80,
        -120,
        max_steps=96,
        samples=states,
      )
      galactic_regional_tail = capture(page, "galactic-regional-tail", wait_ms=0)
      states.append(galactic_regional_tail)
      wheel_until_layer_mix(
        page,
        "galacticLayerPresence",
        "regionalLayerPresence",
        -90,
        floor=0.22,
        ceiling=0.82,
        max_steps=96,
        samples=states,
      )
      galactic_regional_mix = capture(page, "galactic-regional-mix", wait_ms=0)
      states.append(galactic_regional_mix)
      states.append(wheel_until(page, "Regional", -320, max_steps=96, samples=states))
      regional_entry = capture(page, "regional-entry")
      states.append(regional_entry)
      states.append(wheel_until_metric_at_least(page, "bridge", 0.55, -320, max_steps=36, samples=states))
      regional_mid = capture(page, "regional-mid")
      states.append(regional_mid)
      states.append(wheel_until_stage(page, "LocalMap", -320, max_steps=96, samples=states))
      local_entry = capture(page, "local-map-entry", wait_ms=0)
      states.append(local_entry)
      wheel_until_layer_mix(
        page,
        "localMapLayerPresence",
        "localSystemLayerPresence",
        -180,
        floor=0.02,
        ceiling=0.82,
        max_steps=24,
        samples=states,
      )
      wheel_until_stage(page, "LocalSystem", -420, max_steps=24, samples=states)
      local_system_entry = capture(page, "local-system-entry", wait_ms=420)
      states.append(local_system_entry)
      wheel_until_metric_at_least(page, "localSystemPresence", 0.45, -420, max_steps=40, samples=states)
      local_system = capture(page, "local-system", wait_ms=0)
      states.append(local_system)
      transition_samples, sphere_emerge, sphere_close = wheel_through_sphere_transition(page, seed_samples=[local_system])
      states.extend(transition_samples)
      surface_settled = capture(page, "surface-settled")
      states.append(surface_settled)
      surface_spin_b = capture(page, "surface-spin-b", wait_ms=1900)
      states.append(surface_spin_b)
      if float(regional_entry.get("bridge", 0)) <= 0.02:
        raise AssertionError(f"Regional entry should already have bridge presence: {regional_entry}")
      assert_galactic_regional_luminance_continuity([
        ("galactic", galactic_state),
        ("galactic-regional-tail", galactic_regional_tail),
        ("galactic-regional-mix", galactic_regional_mix),
        ("regional-entry", regional_entry),
      ])
      assert_galactic_regional_optical_continuity([
        ("galactic", galactic_state),
        ("galactic-regional-tail", galactic_regional_tail),
        ("galactic-regional-mix", galactic_regional_mix),
        ("regional-entry", regional_entry),
      ])
      assert_mixed_handoff(states, "galacticLayerPresence", "regionalLayerPresence", "Galactic -> Regional", floor=0.04)
      assert_mixed_handoff(states, "regionalLayerPresence", "localMapLayerPresence", "Regional -> LocalMap")
      assert_mixed_handoff(states, "localMapLayerPresence", "localSystemLayerPresence", "LocalMap -> LocalSystem", floor=0.02)
      assert_metric_core_continuity(states)
      assert_bridge_handoff_continuity(states)
      assert_axis_range(regional_entry, 0.18, 0.46, "Regional entry")
      assert_axis_range(regional_mid, 0.18, 0.46, "Regional mid")
      if float(regional_mid.get("regionalLayerPresence", 0)) > 0.75:
        if float(regional_mid.get("galacticLayerPointScale", 1)) > 0.70:
          raise AssertionError(f"galactic points stayed large as Regional took over: {regional_mid}")
        if float(regional_mid.get("galacticLayerHaloScale", 1)) > 0.70:
          raise AssertionError(f"galactic halos stayed strong as Regional took over: {regional_mid}")
      if float(regional_mid.get("bridge", 0)) < 0.45:
        raise AssertionError(f"Regional mid should have a readable bridge layer: {regional_mid}")
      if local_entry.get("scaleStage") != "LocalMap":
        raise AssertionError(f"Local entry should enter the LocalMap stage first: {local_entry}")
      assert_axis_range(local_entry, 0.44, 0.60, "LocalMap")
      if float(local_entry.get("surfacePresence", local_entry.get("surface", 0))) > 0.05:
        raise AssertionError(f"Local entry jumped straight to a full star surface: {local_entry}")
      if float(local_entry.get("sphereScreenRadius", local_entry.get("surfaceRadius", 0))) > 70:
        raise AssertionError(f"Local entry star model was already too large: {local_entry}")
      if float(local_entry.get("metricCatalogPresence", 0)) < 0.70:
        raise AssertionError(f"LocalMap should still retain metric catalog context: {local_entry}")
      if float(local_entry.get("localApproach", 0)) > 0.12:
        raise AssertionError(f"Local map entry started the close-surface approach too early: {local_entry}")
      assert_active_luminance_continuity([
        ("local-map-entry", local_entry),
        ("local-system-entry", local_system_entry),
        ("local-system", local_system),
      ])
      if local_system.get("scaleStage") != "LocalSystem":
        raise AssertionError(f"LocalSystem handoff should happen before Surface: {local_system}")
      assert_axis_range(local_system, 0.58, 0.80, "LocalSystem")
      if float(local_system.get("metricCatalogPresence", 1)) > 0.35:
        raise AssertionError(f"LocalSystem should retire the metric catalog layer: {local_system}")
      if float(local_system.get("metricLayerLabelWeight", 1)) > 0.05:
        raise AssertionError(f"LocalSystem should retire non-active label weight: {local_system}")
      if float(local_system.get("metricLayerPickWeight", 1)) != 0:
        raise AssertionError(f"LocalSystem should retire non-active picking: {local_system}")
      if float(local_system.get("metricLayerPointScale", 1)) > 0.12:
        raise AssertionError(f"LocalSystem metric catalog points should be near zero scale: {local_system}")
      if float(local_system.get("celestialBackdropPresence", 0)) < 0.55:
        raise AssertionError(f"LocalSystem should expose a far-field celestial backdrop: {local_system}")
      if float(local_system.get("localSystemPresence", 0)) < 0.45:
        raise AssertionError(f"LocalSystem optical anchor layer did not appear: {local_system}")
      if float(local_system.get("localReference", 0)) > 0.38:
        raise AssertionError(f"LocalSystem reference geometry dominated the stellar approach: {local_system}")
      if float(local_system.get("activeGlowStrength", 0)) < 0.08:
        raise AssertionError(f"LocalSystem did not expose the active baked glow bridge: {local_system}")
      if float(local_system.get("stellarOpticalLeadIn", 0)) < 0.08:
        raise AssertionError(f"LocalSystem did not expose a same-star optical lead-in before Surface: {local_system}")
      assert_haze_budget(local_system, "LocalSystem", overlay_limit=0.18)
      assert_local_system_preview_pixels("local-system-entry", local_system_entry)
      assert_local_system_preview_pixels("local-system", local_system)
      assert_local_system_pixels("local-system", local_system)
      assert_local_backdrop_pixels("local-system", local_system)
      if float(local_system.get("sphereScreenRadius", local_system.get("surfaceRadius", 0))) > 120:
        raise AssertionError(f"LocalSystem should not already be a giant surface sphere: {local_system}")
      if int(local_system.get("labels", 99)) > 1:
        raise AssertionError(f"LocalSystem should not keep non-active labels in local space: {local_system}")
      emerge_radius = sphere_radius(sphere_emerge)
      if not (70 <= emerge_radius <= 180):
        raise AssertionError(f"sphere emergence should pass through an intermediate visible radius: {sphere_emerge}")
      if float(sphere_emerge.get("surfacePresence", sphere_emerge.get("surface", 0))) >= 0.72:
        raise AssertionError(f"sphere emergence skipped too close to the full-disk state: {sphere_emerge}")
      if sphere_emerge.get("scaleStage") not in {"LocalSystem", "Surface"}:
        raise AssertionError(f"sphere emergence checkpoint should stay within near-field stages: {sphere_emerge}")
      if float(sphere_emerge.get("surfaceReadiness", 1)) >= 0.82:
        raise AssertionError(f"sphere emergence skipped too close to full Surface readiness: {sphere_emerge}")
      if (
        sphere_emerge.get("scaleStage") == "Surface"
        and float(sphere_emerge.get("localSystemLayerPresence", 1)) > 0.20
      ):
        raise AssertionError(f"Surface emergence still competed with LocalSystem anchors: {sphere_emerge}")
      if not (0.20 <= float(sphere_emerge.get("localApproach", 0)) <= 0.95):
        raise AssertionError(f"sphere emergence skipped the intermediate local approach state: {sphere_emerge}")
      if emerge_radius >= 92 and float(sphere_emerge.get("activeImpostorScale", 1)) > 0.58:
        raise AssertionError(f"active light-ball plateau persisted as sphere emerged: {sphere_emerge}")
      if float(sphere_emerge.get("localReference", 0)) > 0.25:
        raise AssertionError(f"LocalSystem reference geometry persisted after sphere preview became readable: {sphere_emerge}")
      if float(sphere_emerge.get("bridge", 0)) > 0.08:
        raise AssertionError(f"regional bridge should be gone before sphere emergence: {sphere_emerge}")
      if float(sphere_emerge.get("activeGlowStrength", 0)) < 0.16:
        raise AssertionError(f"sphere emergence did not keep the active corona glow readable: {sphere_emerge}")
      assert_haze_budget(sphere_emerge, "Sphere emerge", overlay_limit=0.18)
      assert_clear_structure("sphere-emerge", sphere_emerge, min_hf_ratio=0.055, min_edge=3.6)
      assert_local_backdrop_pixels("sphere-emerge", sphere_emerge)
      assert_surface_handoff_progression([local_system, *transition_samples])
      assert_surface_spin_progression([local_system, *transition_samples, sphere_close, surface_settled])
      assert_surface_visual_spin("surface-settled", surface_settled, "surface-spin-b", surface_spin_b)
      if sphere_close.get("scaleStage") != "Surface":
        raise AssertionError(f"close sphere should be in the Surface stage: {sphere_close}")
      assert_axis_range(sphere_close, 0.78, 1.01, "Surface")
      if sphere_close.get("active") != "Sol":
        raise AssertionError(f"default wheel path should stay on Sol: {sphere_close}")
      if float(sphere_close.get("surfacePresence", sphere_close.get("surface", 0))) < 0.45:
        raise AssertionError(f"default wheel path did not reveal the Sol sphere: {sphere_close}")
      if float(sphere_close.get("distance", 0)) >= float(local_entry.get("distance", 0)):
        raise AssertionError(f"default wheel path did not continue inward by distance: {local_entry} -> {sphere_close}")
      default_radius = sphere_radius(sphere_close)
      if not (118 <= default_radius <= 190):
        raise AssertionError(f"default wheel path did not reach a close but bounded sphere radius: {sphere_close}")
      if default_radius <= emerge_radius:
        raise AssertionError(f"sphere radius did not grow continuously: {sphere_emerge} -> {sphere_close}")
      if float(sphere_close.get("localApproach", 0)) < 0.45:
        raise AssertionError(f"close sphere did not enter the local approach response: {sphere_close}")
      if float(sphere_close.get("metricCatalogPresence", 1)) > 0.08:
        raise AssertionError(f"metric catalog did not retreat before Surface: {sphere_close}")
      if float(sphere_close.get("surfaceLayerPresence", 0)) < 0.45:
        raise AssertionError(f"surface layer did not take over in Surface: {sphere_close}")
      if float(sphere_close.get("surfaceReadiness", 0)) < 0.35:
        raise AssertionError(f"Surface stage should expose readable sphere readiness: {sphere_close}")
      if not (0 <= float(sphere_close.get("surfaceDepth", -1)) <= 1.01):
        raise AssertionError(f"Surface depth was not normalized: {sphere_close}")
      if float(sphere_close.get("localSystemLayerPresence", 1)) > 0.78:
        raise AssertionError(f"local system layer did not start retreating in Surface: {sphere_close}")
      if float(sphere_close.get("celestialBackdropPresence", 0)) < 0.35:
        raise AssertionError(f"Surface should retain only far-field stellar context: {sphere_close}")
      if int(sphere_close.get("labels", 99)) > 1:
        raise AssertionError(f"Surface should not keep non-active labels in local space: {sphere_close}")
      if float(sphere_close.get("activeImpostorScale", 1)) > 0.72:
        raise AssertionError(f"active billboard did not hand off to the sphere: {sphere_close}")
      if float(sphere_close.get("activeGlowStrength", 0)) < 0.45:
        raise AssertionError(f"Surface did not retain the active corona glow stack: {sphere_close}")
      assert_haze_budget(sphere_close, "Sphere close", overlay_limit=0.14)
      assert_active_halo_ratio(sphere_close, "Sphere close")
      if float(surface_settled.get("localReference", 0)) > 0.12:
        raise AssertionError(f"Surface should not keep the LocalSystem reference frame: {surface_settled}")
      assert_active_label_off_center(sphere_close)
      assert_active_label_off_center(surface_settled)
      assert_clear_structure("sphere-close", sphere_close, min_hf_ratio=0.038, min_edge=3.4)
      assert_local_backdrop_pixels("sphere-close", sphere_close)
      assert_sphere_pixels("sphere-close", sphere_close)
      assert_no_surface_contour_shell("sphere-close", sphere_close)
      assert_exposure_continuity([
        ("galactic", galactic_state),
        ("regional-entry", regional_entry),
        ("regional-mid", regional_mid),
        ("local-map-entry", local_entry),
        ("local-system", local_system),
        ("sphere-emerge", sphere_emerge),
        ("sphere-close", sphere_close),
        ("surface-settled", surface_settled),
      ])
      assert_background_luminance_continuity([
        ("regional-entry", regional_entry),
        ("regional-mid", regional_mid),
        ("local-map-entry", local_entry),
        ("local-system", local_system),
        ("sphere-emerge", sphere_emerge),
        ("sphere-close", sphere_close),
        ("surface-settled", surface_settled),
      ])
      assert_surface_luminance_anchoring([
        ("local-system", local_system),
        ("sphere-emerge", sphere_emerge),
        ("sphere-close", sphere_close),
        ("surface-settled", surface_settled),
        ("surface-spin-b", surface_spin_b),
      ])
      surface_orbit_a = capture(page, "surface-orbit-a", wait_ms=120)
      states.append(surface_orbit_a)
      send_drag(page, 720, 450, 990, 385, steps=16)
      surface_orbit_b = capture(page, "surface-orbit-b", wait_ms=180)
      states.append(surface_orbit_b)
      if surface_orbit_b.get("active") != surface_orbit_a.get("active"):
        raise AssertionError(f"surface orbit drag changed the active target: {surface_orbit_a} -> {surface_orbit_b}")
      assert_surface_orbit_model_response("surface-orbit-a", surface_orbit_a, "surface-orbit-b", surface_orbit_b)

      page.close()

      page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
      page.goto(url, wait_until="networkidle", timeout=60000)
      wait_for_observatory(page)
      page.mouse.move(720, 450)
      page.wait_for_timeout(850)
      pre_approach = debug_state(page)
      active_before = pre_approach.get("active")
      states.append(pre_approach)
      click_active_target(page, pre_approach)
      surface_state = wait_until_surface_stage(page, minimum_surface=0.45, max_steps=48)
      if surface_state.get("active") != active_before:
        raise AssertionError(f"active target changed during approach: {active_before} -> {surface_state}")
      wait_until_metric_at_most(page, "scale", 0.18, max_steps=32)
      wait_until_camera_near_target(page)
      click_sphere_close = capture(page, "click-sphere-close")
      states.append(click_sphere_close)
      approach_radius = float(click_sphere_close.get("sphereScreenRadius", click_sphere_close.get("surfaceRadius", 0)))
      approach_depth = float(click_sphere_close.get("surfaceDepth", 0))
      assert_haze_budget(click_sphere_close, "Click sphere close", overlay_limit=0.14)
      assert_active_halo_ratio(click_sphere_close, "Click sphere close")
      assert_active_label_off_center(click_sphere_close)
      assert_local_backdrop_pixels("click-sphere-close", click_sphere_close)
      assert_sphere_pixels("click-sphere-close", click_sphere_close)
      assert_no_surface_contour_shell("click-sphere-close", click_sphere_close)

      page.mouse.move(720, 450)
      page.wait_for_timeout(120)
      send_wheel(page, -1800)
      focused_deep = wheel_until_metric_at_most(page, "distance", 80, -900, max_steps=40)
      if float(focused_deep["distance"]) >= float(states[-1]["distance"]) * 0.8:
        raise AssertionError(f"focused wheel zoom did not continue inward: {states[-1]} -> {focused_deep}")
      deep_radius = float(focused_deep.get("sphereScreenRadius", focused_deep.get("surfaceRadius", 0)))
      actual_deep_ratio = deep_radius / max(approach_radius, 0.001)
      if actual_deep_ratio <= 1.015:
        raise AssertionError(
          f"focused wheel zoom did not grow the local-domain surface radius: {states[-1]} -> {focused_deep}"
        )
      if actual_deep_ratio > 1.36 or deep_radius > 205:
        raise AssertionError(
          f"focused star radius grew discontinuously after approach: ratio={actual_deep_ratio:.2f}, state={focused_deep}"
        )
      if float(focused_deep.get("surfaceDepth", 0)) <= approach_depth + 0.04:
        raise AssertionError(f"focused wheel zoom did not advance Surface depth: {states[-1]} -> {focused_deep}")
      focused_deep_capture = capture(page, "focused-deep")
      states.append(focused_deep_capture)
      assert_haze_budget(focused_deep_capture, "Focused deep", overlay_limit=0.14)
      assert_active_halo_ratio(focused_deep_capture, "Focused deep")
      assert_clear_structure("focused-deep", focused_deep_capture, min_hf_ratio=0.030, min_edge=3.4)
      assert_local_backdrop_pixels("focused-deep", focused_deep_capture)
      assert_no_surface_contour_shell("focused-deep", focused_deep_capture)
      assert_exposure_continuity([
        ("click-sphere-close", click_sphere_close),
        ("focused-deep", focused_deep_capture),
      ])
      assert_background_luminance_continuity([
        ("click-sphere-close", click_sphere_close),
        ("focused-deep", focused_deep_capture),
      ])
      assert_surface_luminance_anchoring([
        ("click-sphere-close", click_sphere_close),
        ("focused-deep", focused_deep_capture),
      ])

      for _ in range(18):
        send_wheel(page, 1900)
        page.wait_for_timeout(360)
      wait_until_metric_at_most(page, "surfacePresence", 0.12)
      states.extend([
        wheel_until(page, "Galactic", 1900, max_steps=160),
        capture(page, "zoom-out"),
      ])
      if float(states[-1].get("localReference", 0)) > 0.12:
        raise AssertionError(f"local reference frame did not fade after zoom-out: {states[-1]}")
      for state in states:
        assert_state(state)
        assert_no_competing_primary_layers(state)
      create_contact_sheet()
      browser.close()
      browser = None
  finally:
    if browser is not None:
      with contextlib.suppress(Exception):
        browser.close()
    server.terminate()
    with contextlib.suppress(subprocess.TimeoutExpired):
      server.wait(timeout=5)
    if server.poll() is None:
      server.kill()
  print(f"screenshots: {OUT_DIR}")
  print(f"contact sheet: {OUT_DIR / 'contact-sheet.jpg'}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
