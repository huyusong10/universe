// Curated comparisons of existing targets. The route owns no camera or catalog.
// Progress belongs to this page session and requires an actual observation.
export const EXPLORATION_ROUTES = [
  {
    key: 'sunlight', color: '#e4c895',
    sourceUrl: 'https://science.nasa.gov/sun/facts/', sourceLabel: 'NASA',
    en: {
      name: 'Follow the sunlight',
      invitation: 'From a glowing star to oceans, moonlight and flowing tails.',
      context: 'Explore how the Sun lights and energises different worlds. Each stop is yours to orbit, approach and leave.'
    },
    zh: {
      name: '追随太阳的光',
      invitation: '从发光的恒星，到海洋、月色与流动的彗尾。',
      context: '看看太阳如何照亮、驱动不同的世界。每一站都可以自由环视、靠近和离开。'
    },
    stops: [
      { target: 'Sol', en: 'Begin at the photosphere; energy comes from fusion deep within the Sun.', zh: '从光球出发；太阳的能量来自内部的核聚变。' },
      { target: 'Earth', en: 'Find the sunlit oceans, clouds and the boundary of night.', zh: '寻找阳光下的海洋、云层与夜晚的边界。' },
      { target: 'Moon', en: 'Follow sunlight across ancient plains and crater rims.', zh: '沿着阳光，观察古老月海与陨石坑边缘。' },
      { target: "Halley's Comet", en: 'Compare the dark nucleus with the gas and dust released near the Sun.', zh: '对照暗色彗核与接近太阳时逸出的气体和尘埃。' }
    ]
  },
  {
    key: 'stellar-stories', color: '#b5abd9',
    sourceUrl: 'https://science.nasa.gov/universe/stars/', sourceLabel: 'NASA',
    en: {
      name: 'Clouds, giants and remnants',
      invitation: 'Visit a stellar nursery, a late-life giant and a compact remnant.',
      context: 'Compare different real examples of stellar birth and the endings of massive stars. Each has its own history; the scene compresses their positions and scale.'
    },
    zh: {
      name: '育星云、巨星与残骸',
      invitation: '进入育星的云，拜访晚期巨星，再看致密的残骸。',
      context: '用不同的真实天体，对照恒星诞生与大质量恒星的晚期。每个例子有自己的历史；场景位置与比例经过压缩。'
    },
    stops: [
      { target: 'Orion Nebula', en: 'Enter the luminous gas around young stars and look for dark dust.', zh: '进入年轻恒星周围发光的气体，寻找暗尘。' },
      { target: 'Betelgeuse', en: 'Orbit the expanded outer layers of a red supergiant late in its life.', zh: '环视生命晚期红超巨星膨胀的外层。' },
      { target: 'Crab Pulsar', en: 'Examine the dense core left by a different massive star and its slowed beam illustration.', zh: '观察另一颗大质量恒星留下的致密核心与放慢的辐射束示意。' }
    ]
  }
];

export function describeExplorationRoute(key, language = 'en') {
  const route = EXPLORATION_ROUTES.find(item => item.key === key);
  if (!route) return null;
  const locale = language === 'zh' ? 'zh' : 'en';
  return { key: route.key, color: route.color, sourceUrl: route.sourceUrl, sourceLabel: route.sourceLabel,
    ...route[locale], stops: route.stops.map(stop => ({ target: stop.target, prompt: stop[locale] })) };
}

export function availableExplorationRoutes(destinations) {
  const names = new Set(destinations.map(body => body.target));
  return EXPLORATION_ROUTES.filter(route => route.stops.every(stop => names.has(stop.target)));
}

export function createRouteProgress(key) {
  return describeExplorationRoute(key) ? { key, visited: [] } : null;
}

export function rememberRouteObservation(progress, state) {
  const route = describeExplorationRoute(progress?.key);
  if (!route || !state || state.flight || !Number.isInteger(state.observedId) ||
      state.observedId < 0 || state.activeId !== state.observedId || state.active !== state.observed ||
      !['observing', 'zooming'].includes(state.navigationState) ||
      !['LocalSystem', 'Surface'].includes(state.scaleStage) || state.systemView ||
      !route.stops.some(stop => stop.target === state.observed) ||
      progress.visited.includes(state.observed)) return progress;
  return { key: progress.key, visited: [...progress.visited, state.observed] };
}

export function nextRouteStop(progress, language = 'en') {
  return describeExplorationRoute(progress?.key, language)?.stops.find(stop => !progress.visited.includes(stop.target)) || null;
}
