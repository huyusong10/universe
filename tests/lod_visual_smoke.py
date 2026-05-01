#!/usr/bin/env python3
"""Smoke-check the observatory LOD path and capture review screenshots."""

from __future__ import annotations

import contextlib
import math
import re
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path("/tmp/universe-os-lod-smoke")


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
  for key in (
    "scale",
    "scaleTarget",
    "cameraFov",
    "distance",
    "distanceTarget",
    "scaleDepth",
    "scaleAxisProgress",
    "bridge",
    "exposure",
    "rotationPhase",
    "activity",
    "localReference",
    "localApproach",
    "metricCatalogPresence",
    "metricLayerPresence",
    "metricLayerPointScale",
    "metricLayerHaloScale",
    "metricLayerLabelWeight",
    "metricLayerPickWeight",
    "metricLayerOpacity",
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
    "localSystemLayerLabelWeight",
    "localSystemLayerPickWeight",
    "surfaceLayerPresence",
    "surfaceLayerPointScale",
    "surfaceLayerLabelWeight",
    "surfaceLayerPickWeight",
    "celestialBackdropPresence",
    "localSystemPresence",
    "surfaceViewRadiusStarR",
    "contextScale",
    "activeImpostorScale",
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
  ):
    if key in state:
      state[key] = float(str(state[key]))
  for key in ("catalog", "draw", "labels", "sphereTriangles", "sphereDraw"):
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


def wheel_until(page, target_lod: str, delta_y: int, max_steps: int = 64) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if state["lod"] == target_lod:
      return state
    send_wheel(page, delta_y)
    page.wait_for_timeout(520)
  state = debug_state(page)
  raise AssertionError(f"expected {target_lod}, reached {state}")


def wheel_until_stage(page, target_stage: str, delta_y: int, max_steps: int = 64) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if state.get("scaleStage") == target_stage:
      return state
    send_wheel(page, delta_y)
    page.wait_for_timeout(520)
  state = debug_state(page)
  raise AssertionError(f"expected scaleStage={target_stage}, reached {state}")


def wheel_until_metric_at_most(
  page,
  key: str,
  maximum: float,
  delta_y: int,
  max_steps: int = 64,
) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
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
) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    if float(state.get(key, 0)) >= minimum:
      return state
    send_wheel(page, delta_y)
    page.wait_for_timeout(420)
  state = debug_state(page)
  raise AssertionError(f"expected {key} >= {minimum}, reached {state}")


def wheel_until_sphere_emerges(page, delta_y: int = -45, max_steps: int = 180) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    radius = float(state.get("sphereScreenRadius", state.get("surfaceRadius", 0)))
    surface = float(state.get("surfacePresence", state.get("surface", 0)))
    local_approach = float(state.get("localApproach", 0))
    if 70 <= radius <= 180 and 0.20 <= local_approach <= 0.75 and 0.02 <= surface < 0.72:
      return state
    send_wheel(page, 90 if radius > 180 or local_approach > 0.75 else delta_y)
    page.wait_for_timeout(180)
  state = debug_state(page)
  raise AssertionError(f"expected sphere to emerge gradually, reached {state}")


def sphere_radius(state: dict[str, object]) -> float:
  return float(state.get("sphereScreenRadius", state.get("surfaceRadius", 0)))


def assert_sphere_growth_continuity(samples: list[dict[str, object]]) -> None:
  in_range = [state for state in samples if 60 <= sphere_radius(state) <= 360]
  if len(in_range) < 4:
    raise AssertionError(f"not enough sphere transition samples for continuity check: {in_range}")
  previous = sphere_radius(in_range[0])
  for state in in_range[1:]:
    radius = sphere_radius(state)
    if radius / max(previous, 0.001) > 1.35:
      raise AssertionError(
        f"sphere radius jumped too quickly: previous={previous:.1f} current={radius:.1f} state={state}"
      )
    if previous < 120 and radius > 260:
      raise AssertionError(
        f"sphere radius skipped the local-system bridge: previous={previous:.1f} current={radius:.1f} state={state}"
      )
    previous = radius


def wheel_through_sphere_transition(page, delta_y: int = -45, max_steps: int = 180):
  samples: list[dict[str, object]] = []
  sphere_emerge = None
  sphere_close = None
  for _ in range(max_steps):
    state = debug_state(page)
    radius = sphere_radius(state)
    local_approach = float(state.get("localApproach", 0))
    if 60 <= radius <= 360:
      samples.append(state)
    surface = float(state.get("surfacePresence", state.get("surface", 0)))
    if sphere_emerge is None and 70 <= radius <= 180 and 0.20 <= local_approach <= 0.95 and 0.02 <= surface < 0.72:
      sphere_emerge = capture(page, "sphere-emerge", wait_ms=250)
      samples.append(sphere_emerge)
    if 220 <= radius <= 420:
      sphere_close = capture(page, "sphere-close", wait_ms=250)
      samples.append(sphere_close)
      assert_sphere_growth_continuity(samples)
      if sphere_emerge is None:
        raise AssertionError(f"sphere transition skipped the emergence window: {samples}")
      return samples, sphere_emerge, sphere_close
    send_wheel(page, 90 if radius > 420 else delta_y)
    page.wait_for_timeout(180)
  state = debug_state(page)
  raise AssertionError(f"expected sphere transition through close state, reached {state}")


def wheel_until_sphere_radius(
  page,
  minimum: float,
  maximum: float,
  delta_y: int = -120,
  max_steps: int = 64,
) -> dict[str, object]:
  for _ in range(max_steps):
    state = debug_state(page)
    radius = float(state.get("sphereScreenRadius", state.get("surfaceRadius", 0)))
    if minimum <= radius <= maximum:
      return state
    send_wheel(page, 120 if radius > maximum else delta_y)
    page.wait_for_timeout(260)
  state = debug_state(page)
  raise AssertionError(f"expected sphere radius in [{minimum}, {maximum}], reached {state}")


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
  if not str(state["version"]).startswith("newnew-stars-observatory-"):
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
    "celestialBackdropPresence",
    "localSystemPresence",
    "surfaceViewRadiusStarR",
    "galacticLayerPresence",
    "regionalLayerPresence",
    "localMapLayerPresence",
    "localSystemLayerPresence",
    "surfaceLayerPresence",
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
    "celestialBackdropPresence",
    "localSystemPresence",
    "galacticLayerPresence",
    "regionalLayerPresence",
    "localMapLayerPresence",
    "localSystemLayerPresence",
    "surfaceLayerPresence",
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
  if not (0.11 <= active_impostor_scale <= 1.01):
    raise AssertionError(f"active impostor scale escaped expected bounds: {state}")


def assert_active_label_off_center(state: dict[str, object]) -> None:
  radius = float(state.get("sphereScreenRadius", state.get("surfaceRadius", 0)))
  if radius <= 120:
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


def assert_axis_range(state: dict[str, object], minimum: float, maximum: float, label: str) -> None:
  value = float(state.get("scaleAxisProgress", -1))
  if not (minimum <= value <= maximum):
    raise AssertionError(f"{label} scale axis progress escaped [{minimum}, {maximum}]: {state}")


def assert_no_competing_primary_layers(state: dict[str, object]) -> None:
  if float(state.get("regionalLayerPresence", 0)) > 0.75 and float(state.get("galacticLayerPresence", 0)) > 0.85:
    raise AssertionError(f"regional layer took over while galactic layer still dominated: {state}")
  if float(state.get("localMapLayerPresence", 0)) > 0.75 and float(state.get("regionalLayerPresence", 0)) > 0.75:
    raise AssertionError(f"local map layer took over while regional layer still dominated: {state}")
  if float(state.get("surfaceLayerPresence", 0)) > 0.45 and float(state.get("localSystemLayerPresence", 0)) > 0.78:
    raise AssertionError(f"surface layer took over before local system layer began retreating: {state}")


def sample_luma(image: Image.Image, x: float, y: float, radius: int = 8) -> float:
  left = max(0, int(x) - radius)
  top = max(0, int(y) - radius)
  right = min(image.width, int(x) + radius + 1)
  bottom = min(image.height, int(y) + radius + 1)
  crop = image.convert("L").crop((left, top, right, bottom))
  return float(ImageStat.Stat(crop).mean[0])


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
  if stat.mean[0] < 12 or stat.stddev[0] < 8:
    raise AssertionError(
      f"{name}: visible WebGPU scene did not contain enough sphere pixels "
      f"(mean={stat.mean[0]:.2f} std={stat.stddev[0]:.2f}, state={state})"
    )
  highlight = sample_luma(image, active_x - radius * 0.18, active_y - radius * 0.22, 10)
  limb = sample_luma(image, active_x + radius * 0.58, active_y + radius * 0.28, 10)
  if abs(highlight - limb) < 7:
    raise AssertionError(
      f"{name}: visible sphere lacked a readable brightness gradient "
      f"(highlight={highlight:.2f} limb={limb:.2f}, state={state})"
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
      states.append(wheel_until(page, "Regional", -520))
      regional_entry = capture(page, "regional-entry")
      states.append(regional_entry)
      states.append(wheel_until_metric_at_least(page, "bridge", 0.55, -520, max_steps=24))
      regional_mid = capture(page, "regional-mid")
      states.append(regional_mid)
      states.append(wheel_until(page, "Local", -520))
      local_entry = capture(page, "local-map-entry")
      states.append(local_entry)
      wheel_until_metric_at_least(page, "localSystemPresence", 0.45, -420, max_steps=40)
      local_system = capture(page, "local-system")
      states.append(local_system)
      transition_samples, sphere_emerge, sphere_close = wheel_through_sphere_transition(page)
      states.extend(transition_samples)
      local_reference = capture(page, "local-reference")
      states.append(local_reference)
      if float(regional_entry.get("bridge", 0)) <= 0.02:
        raise AssertionError(f"Regional entry should already have bridge presence: {regional_entry}")
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
        raise AssertionError(f"LocalSystem shell/reference layer did not appear: {local_system}")
      if float(local_system.get("sphereScreenRadius", local_system.get("surfaceRadius", 0))) > 120:
        raise AssertionError(f"LocalSystem should not already be a giant surface sphere: {local_system}")
      if int(local_system.get("labels", 99)) > 1:
        raise AssertionError(f"LocalSystem should not keep non-active labels in local space: {local_system}")
      emerge_radius = sphere_radius(sphere_emerge)
      if not (70 <= emerge_radius <= 180):
        raise AssertionError(f"sphere emergence should pass through an intermediate visible radius: {sphere_emerge}")
      if float(sphere_emerge.get("surfacePresence", sphere_emerge.get("surface", 0))) >= 0.72:
        raise AssertionError(f"sphere emergence skipped too close to the full-disk state: {sphere_emerge}")
      if not (0.20 <= float(sphere_emerge.get("localApproach", 0)) <= 0.95):
        raise AssertionError(f"sphere emergence skipped the intermediate local approach state: {sphere_emerge}")
      if float(sphere_emerge.get("bridge", 0)) > 0.08:
        raise AssertionError(f"regional bridge should be gone before sphere emergence: {sphere_emerge}")
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
      if not (220 <= default_radius <= 420):
        raise AssertionError(f"default wheel path did not reach a close but bounded sphere radius: {sphere_close}")
      if default_radius <= emerge_radius:
        raise AssertionError(f"sphere radius did not grow continuously: {sphere_emerge} -> {sphere_close}")
      if float(sphere_close.get("localApproach", 0)) < 0.45:
        raise AssertionError(f"close sphere did not enter the local approach response: {sphere_close}")
      if float(sphere_close.get("metricCatalogPresence", 1)) > 0.08:
        raise AssertionError(f"metric catalog did not retreat before Surface: {sphere_close}")
      if float(sphere_close.get("surfaceLayerPresence", 0)) < 0.45:
        raise AssertionError(f"surface layer did not take over in Surface: {sphere_close}")
      if float(sphere_close.get("localSystemLayerPresence", 1)) > 0.78:
        raise AssertionError(f"local system layer did not start retreating in Surface: {sphere_close}")
      if float(sphere_close.get("celestialBackdropPresence", 0)) < 0.35:
        raise AssertionError(f"Surface should retain only far-field stellar context: {sphere_close}")
      if int(sphere_close.get("labels", 99)) > 1:
        raise AssertionError(f"Surface should not keep non-active labels in local space: {sphere_close}")
      if float(sphere_close.get("activeImpostorScale", 1)) > 0.72:
        raise AssertionError(f"active billboard did not hand off to the sphere: {sphere_close}")
      if float(local_reference.get("localReference", 0)) < 0.35:
        raise AssertionError(f"local reference frame did not appear near the active sphere: {local_reference}")
      assert_active_label_off_center(sphere_close)
      assert_active_label_off_center(local_reference)
      assert_sphere_pixels("sphere-close", sphere_close)

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
      surface_state = wait_until_metric_at_least(page, "surfacePresence", 0.45, max_steps=24)
      if surface_state.get("active") != active_before:
        raise AssertionError(f"active target changed during approach: {active_before} -> {surface_state}")
      if surface_state.get("scaleStage") != "Surface":
        raise AssertionError(f"click approach should arrive in the Surface stage: {surface_state}")
      wait_until_metric_at_most(page, "scale", 0.18, max_steps=32)
      states.append(capture(page, "click-sphere-close"))
      approach_radius = float(states[-1].get("sphereScreenRadius", states[-1].get("surfaceRadius", 0)))
      assert_active_label_off_center(states[-1])
      assert_sphere_pixels("click-sphere-close", states[-1])

      page.mouse.move(720, 450)
      page.wait_for_timeout(120)
      send_wheel(page, -1800)
      focused_deep = wheel_until_metric_at_most(page, "distance", 80, -900, max_steps=40)
      if float(focused_deep["distance"]) >= float(states[-1]["distance"]) * 0.8:
        raise AssertionError(f"focused wheel zoom did not continue inward: {states[-1]} -> {focused_deep}")
      deep_radius = float(focused_deep.get("sphereScreenRadius", focused_deep.get("surfaceRadius", 0)))
      actual_deep_ratio = deep_radius / max(approach_radius, 0.001)
      if actual_deep_ratio <= 1.08:
        raise AssertionError(
          f"focused wheel zoom did not grow the local-domain surface radius: {states[-1]} -> {focused_deep}"
        )
      if actual_deep_ratio > 2.35 or deep_radius > 430:
        raise AssertionError(
          f"focused star radius grew discontinuously after approach: ratio={actual_deep_ratio:.2f}, state={focused_deep}"
        )
      states.append(capture(page, "focused-deep"))

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
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
