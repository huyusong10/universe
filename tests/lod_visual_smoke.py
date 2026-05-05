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
  "local-reference",
  "click-sphere-close",
  "focused-deep",
  "zoom-out",
)

DEBUG_FLOAT_KEYS = (
  "scale",
  "scaleTarget",
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
  "surfaceReadiness",
  "surfaceDepth",
  "surfaceViewRadiusStarR",
  "contextScale",
  "activeImpostorScale",
  "activeHaloRatio",
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
  in_range = [state for state in samples if 70 <= sphere_radius(state) <= 460]
  if len(in_range) < 4:
    raise AssertionError(f"not enough sphere transition samples for continuity check: {in_range}")
  previous = sphere_radius(in_range[0])
  for state in in_range[1:]:
    radius = sphere_radius(state)
    if radius / max(previous, 0.001) > 1.75:
      raise AssertionError(
        f"sphere radius jumped too quickly: previous={previous:.1f} current={radius:.1f} state={state}"
      )
    if previous < 120 and radius > 260:
      raise AssertionError(
        f"sphere radius skipped the local-system bridge: previous={previous:.1f} current={radius:.1f} state={state}"
      )
    previous = radius


def wheel_through_sphere_transition(page, delta_y: int = -28, max_steps: int = 220):
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
    readiness = float(state.get("surfaceReadiness", 0))
    if sphere_emerge is None and 70 <= radius <= 180 and 0.20 <= local_approach <= 0.95 and 0.02 <= surface < 0.30 and readiness < 0.20:
      sphere_emerge = capture(page, "sphere-emerge", wait_ms=0)
      samples.append(sphere_emerge)
    if 220 <= radius <= 460 and readiness >= 0.48:
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
  if not (0.11 <= active_impostor_scale <= 1.01):
    raise AssertionError(f"active impostor scale escaped expected bounds: {state}")
  active_halo_ratio = float(state.get("activeHaloRatio", 0))
  if not (0 <= active_halo_ratio <= 2.21):
    raise AssertionError(f"active halo ratio escaped expected bounds: {state}")


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
  if stddev < min_stddev or ratio < min_hf_ratio or edge_energy < min_edge:
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


def background_luminance_metrics(name: str) -> tuple[float, float]:
  image = Image.open(OUT_DIR / f"{name}.png").convert("L")
  width, height = image.size
  top = min(height - 1, 120)
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


def surface_luminance_metrics(name: str, state: dict[str, object]) -> tuple[float, float, float]:
  image = Image.open(OUT_DIR / f"{name}.png").convert("L")
  width, height = image.size
  full = list(image.crop((0, min(height - 1, 120), width, height)).getdata())
  background_mean, _ = background_luminance_metrics(name)
  active_x = float(state.get("activeX", width * 0.5))
  active_y = float(state.get("activeY", height * 0.5))
  sphere_radius = float(state.get("sphereScreenRadius", state.get("surfaceRadius", 60)))
  crop_radius = max(110, min(260, sphere_radius * 0.88))
  left = max(0, int(active_x - crop_radius))
  top = max(120, int(active_y - crop_radius))
  right = min(width, int(active_x + crop_radius))
  bottom = min(height, int(active_y + crop_radius))
  center = list(image.crop((left, top, right, bottom)).getdata())
  return trimmed_luminance_mean(full), background_mean, trimmed_luminance_mean(center)


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
    if mass_delta > max(0.62, min(left["mass16"], right["mass16"]) * 0.42) or mean_delta > 1.25 or p95_delta > 8:
      raise AssertionError(
        "continuous wheel zoom produced a frame-to-frame luminance flicker "
        f"between frames {left_step} and {right_step}: "
        f"{left} -> {right}, states={left_state} -> {right_state}"
      )


def assert_surface_luminance_anchoring(named_states: list[tuple[str, dict[str, object]]]) -> None:
  metrics = [(name, *surface_luminance_metrics(name, state)) for name, state in named_states]
  if len(metrics) < 2:
    return
  full_values = [full for _, full, _, _ in metrics]
  background_values = [background for _, _, background, _ in metrics]
  if max(full_values) - min(full_values) > 3.0:
    raise AssertionError(f"Surface handoff changed full-frame luminance too much: {metrics}")
  if max(background_values) - min(background_values) > 1.6:
    raise AssertionError(f"Surface handoff changed background luminance too much: {metrics}")
  for (left_name, left_full, left_bg, left_center), (right_name, right_full, right_bg, right_center) in zip(metrics, metrics[1:]):
    if abs(right_full - left_full) > 1.60 or abs(right_bg - left_bg) > 0.90:
      raise AssertionError(
        f"Surface handoff luminance jumped between {left_name} and {right_name}: {metrics}"
      )
    if right_center < left_center - 4.6 or right_center > left_center + 4.2:
      raise AssertionError(
        f"Surface subject luminance was not anchored between {left_name} and {right_name}: {metrics}"
      )


def assert_active_luminance_continuity(named_states: list[tuple[str, dict[str, object]]]) -> None:
  metrics = [(name, *surface_luminance_metrics(name, state)) for name, state in named_states]
  if len(metrics) < 2:
    return
  for (left_name, _, _, left_center), (right_name, _, _, right_center) in zip(metrics, metrics[1:]):
    if right_center < left_center - 1.8:
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
      metric["bright16"] < baseline["bright16"] * 0.90
      or metric["bright24"] < baseline["bright24"] * 0.68
      or metric["mass16"] < baseline["mass16"] * 0.80
      or metric["p95"] < baseline["p95"] - 1.0
    ):
      raise AssertionError(
        "Galactic -> Regional handoff collapsed star PSF/halo area "
        f"from {baseline_name} to {name}: {metrics}"
      )
    label_heavy = float(states.get(name, {}).get("labels", 0)) > 12
    if (
      not label_heavy
      and (metric["mass16"] > baseline["mass16"] * 1.24 + 0.12 or metric["p95"] > baseline["p95"] + 5.5)
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


def assert_background_luminance_continuity(names: list[str]) -> None:
  metrics = [(name, *background_luminance_metrics(name)) for name in names]
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
  if stat.mean[0] < 12 or stat.stddev[0] < 7.5:
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
  assert_clear_structure(name, state, min_hf_ratio=0.12, min_edge=3.6, min_stddev=3.2)


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
        -180,
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
      wheel_until_stage(page, "LocalSystem", -420, max_steps=24, samples=states)
      local_system_entry = capture(page, "local-system-entry", wait_ms=0)
      states.append(local_system_entry)
      wheel_until_metric_at_least(page, "localSystemPresence", 0.45, -420, max_steps=40, samples=states)
      local_system = capture(page, "local-system")
      states.append(local_system)
      transition_samples, sphere_emerge, sphere_close = wheel_through_sphere_transition(page)
      states.extend(transition_samples)
      local_reference = capture(page, "local-reference")
      states.append(local_reference)
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
      assert_mixed_handoff(states, "localMapLayerPresence", "localSystemLayerPresence", "LocalMap -> LocalSystem", floor=0.04)
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
        raise AssertionError(f"LocalSystem shell/reference layer did not appear: {local_system}")
      assert_haze_budget(local_system, "LocalSystem", overlay_limit=0.18)
      assert_local_system_pixels("local-system", local_system)
      if float(local_system.get("sphereScreenRadius", local_system.get("surfaceRadius", 0))) > 120:
        raise AssertionError(f"LocalSystem should not already be a giant surface sphere: {local_system}")
      if int(local_system.get("labels", 99)) > 1:
        raise AssertionError(f"LocalSystem should not keep non-active labels in local space: {local_system}")
      emerge_radius = sphere_radius(sphere_emerge)
      if not (70 <= emerge_radius <= 180):
        raise AssertionError(f"sphere emergence should pass through an intermediate visible radius: {sphere_emerge}")
      if float(sphere_emerge.get("surfacePresence", sphere_emerge.get("surface", 0))) >= 0.72:
        raise AssertionError(f"sphere emergence skipped too close to the full-disk state: {sphere_emerge}")
      if sphere_emerge.get("scaleStage") != "LocalSystem":
        raise AssertionError(f"early sphere emergence should still be LocalSystem until the sphere is readable: {sphere_emerge}")
      if float(sphere_emerge.get("surfaceReadiness", 1)) >= 0.20:
        raise AssertionError(f"early sphere emergence reported Surface readiness too early: {sphere_emerge}")
      if not (0.20 <= float(sphere_emerge.get("localApproach", 0)) <= 0.95):
        raise AssertionError(f"sphere emergence skipped the intermediate local approach state: {sphere_emerge}")
      if float(sphere_emerge.get("bridge", 0)) > 0.08:
        raise AssertionError(f"regional bridge should be gone before sphere emergence: {sphere_emerge}")
      assert_haze_budget(sphere_emerge, "Sphere emerge", overlay_limit=0.18)
      assert_clear_structure("sphere-emerge", sphere_emerge, min_hf_ratio=0.055, min_edge=3.6)
      assert_mixed_handoff(transition_samples, "localSystemLayerPresence", "surfaceLayerPresence", "LocalSystem -> Surface", floor=0.08)
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
      if not (220 <= default_radius <= 460):
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
      assert_haze_budget(sphere_close, "Sphere close", overlay_limit=0.14)
      assert_active_halo_ratio(sphere_close, "Sphere close")
      if float(local_reference.get("localReference", 0)) < 0.35:
        raise AssertionError(f"local reference frame did not appear near the active sphere: {local_reference}")
      assert_active_label_off_center(sphere_close)
      assert_active_label_off_center(local_reference)
      assert_clear_structure("sphere-close", sphere_close, min_hf_ratio=0.038, min_edge=3.4)
      assert_sphere_pixels("sphere-close", sphere_close)
      assert_exposure_continuity([
        ("galactic", galactic_state),
        ("regional-entry", regional_entry),
        ("regional-mid", regional_mid),
        ("local-map-entry", local_entry),
        ("local-system", local_system),
        ("sphere-emerge", sphere_emerge),
        ("sphere-close", sphere_close),
        ("local-reference", local_reference),
      ])
      assert_background_luminance_continuity([
        "regional-entry",
        "regional-mid",
        "local-map-entry",
        "local-system",
        "sphere-emerge",
        "sphere-close",
        "local-reference",
      ])
      assert_surface_luminance_anchoring([
        ("local-system", local_system),
        ("sphere-emerge", sphere_emerge),
        ("sphere-close", sphere_close),
        ("local-reference", local_reference),
      ])

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
      click_sphere_close = capture(page, "click-sphere-close")
      states.append(click_sphere_close)
      approach_radius = float(click_sphere_close.get("sphereScreenRadius", click_sphere_close.get("surfaceRadius", 0)))
      approach_depth = float(click_sphere_close.get("surfaceDepth", 0))
      assert_haze_budget(click_sphere_close, "Click sphere close", overlay_limit=0.14)
      assert_active_halo_ratio(click_sphere_close, "Click sphere close")
      assert_active_label_off_center(click_sphere_close)
      assert_sphere_pixels("click-sphere-close", click_sphere_close)

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
      if actual_deep_ratio > 2.35 or deep_radius > 460:
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
      assert_exposure_continuity([
        ("click-sphere-close", click_sphere_close),
        ("focused-deep", focused_deep_capture),
      ])
      assert_background_luminance_continuity(["click-sphere-close", "focused-deep"])
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
