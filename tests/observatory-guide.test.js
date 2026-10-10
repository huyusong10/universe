import test from 'node:test';
import assert from 'node:assert/strict';
import { DESTINATIONS, DESTINATION_CATEGORIES, TARGET_NOTES, targetDisplayNames, describeTarget, describeSpaceContext, describeObservationScale, searchDestinations, browseDestinations } from '../assets/observatory-guide.js';
import { createCatalog, resolveCatalogTarget, namedDestinations } from '../assets/observatory-model.js';
import { EXPLORATION_ROUTES, availableExplorationRoutes, describeExplorationRoute, createRouteProgress, rememberRouteObservation, nextRouteStop } from '../assets/observatory-routes.js';
import { observationSources, observationSourceDescription } from '../assets/observatory-capture.js';

test('saved observation references belong to the observed body and assets retain their own identities', () => {
  for (const language of ['en', 'zh']) {
    const sources = observationSources({ observed: 'Jupiter', active: 'Vela Pulsar', scaleStage: 'Surface', mapBodies: ['jupiter', 'callisto', 'jupiter'] }, language);
    assert.deepEqual(sources.references.map(row => row.target), ['Jupiter']);
    assert.deepEqual(sources.subjectAssets.map(row => row.target), ['Jupiter']);
    assert.deepEqual(sources.sceneAssets.map(row => row.target), ['Callisto']);
    assert.equal(sources.sceneAssets[0].name, describeTarget('Callisto', language).name);
    assert.equal(sources.subjectAssets[0].license.url, 'https://creativecommons.org/licenses/by/4.0/');
    const description = observationSourceDescription(sources, language);
    for (const row of [...sources.references, ...sources.subjectAssets, ...sources.sceneAssets, sources.sky]) {
      for (const url of row.urls) assert.ok(description.includes(url));
      if (row.name) assert.ok(description.includes(row.name));
    }
    assert.ok(!description.includes(describeTarget('Vela Pulsar', language).sourceUrl));
  }
});

test('saved family and global views keep asset ownership without inventing one subject map', () => {
  for (const view of [{ scaleStage: 'Galactic' }, { scaleStage: 'System', systemView: { visible: true, pending: false } }]) {
    const sources = observationSources({ observed: '67P/Churyumov-Gerasimenko', mapBodies: ['earth', 'moon'], shapeTargets: ['67P/Churyumov-Gerasimenko', '67P/Churyumov-Gerasimenko'], ...view });
    assert.equal(sources.subjectAssets.length, 0);
    assert.deepEqual(new Set(sources.sceneAssets.map(row => row.kind)), new Set(['map', 'shape']));
    assert.ok(sources.sceneAssets.some(row => row.target === 'Earth' && row.urls.includes('https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/')));
    assert.ok(sources.sceneAssets.some(row => row.target === 'Moon' && row.urls.includes('https://svs.gsfc.nasa.gov/4720/')));
    assert.equal(sources.sceneAssets.find(row => row.kind === 'shape').license.url, 'https://creativecommons.org/licenses/by-sa/3.0/igo/');
    assert.equal(sources.references[0].urls[0], describeTarget('67P/Churyumov-Gerasimenko').sourceUrl);
  }
  const generated = observationSources({ observed: 'UO 01001', scaleStage: 'Surface', mapBodies: ['psyche'] });
  assert.deepEqual(generated.references, []);
  assert.deepEqual(generated.subjectAssets, []);
  assert.deepEqual(generated.sceneAssets, []);
  assert.ok(generated.sky.urls.length);
  const crab = observationSources({ observed: 'Crab Pulsar', scaleStage: 'Surface' });
  assert.deepEqual(crab.references.map(row => row.kind), ['science', 'observation']);
});

test('finite scene names share guide presentation without replacing catalog identity', () => {
  const catalog = createCatalog({ budget: 'safe' }), targets = namedDestinations(catalog);
  const original = structuredClone(targets);
  for (const language of ['en', 'zh']) {
    const names = targetDisplayNames(language);
    assert.equal(names.size, new Set(TARGET_NOTES.map(note => note.target)).size);
    for (const target of targets) {
      const displayed = names.get(target.target) || target.target;
      assert.equal(displayed, describeTarget(target.target, language).name);
      assert.equal(resolveCatalogTarget(catalog, target.target).id, target.id);
    }
    assert.equal(names.has('UO 01234'), false);
    assert.equal(names.has('Uncatalogued object'), false);
  }
  assert.deepEqual(targetDisplayNames('unknown'), targetDisplayNames('en'));
  assert.deepEqual(targets, original);
});

test('current-view discovery intersects identity, category, space and bilingual query while preserving all-target browsing', () => {
  const catalog=createCatalog({budget:'safe'}),targets=namedDestinations(catalog),original=structuredClone(targets);
  const names=['Needle Galaxy','Whirlpool Galaxy','Earth','Sirius'];
  const visibleIds=new Set(names.map(name=>resolveCatalogTarget(catalog,name).id));
  const inView=browseDestinations(targets,{visibleIds});
  assert.deepEqual(new Set(inView.map(body=>body.target)),new Set(names));
  assert.deepEqual(browseDestinations(targets,{visibleIds,category:'galaxy'}).map(body=>body.target).sort(),['Needle Galaxy','Whirlpool Galaxy']);
  assert.deepEqual(browseDestinations(targets,{visibleIds,region:'milky-way'}).map(body=>body.target).sort(),['Earth','Sirius']);
  for(const query of['针状星系','Needle','NGC 4565'])assert.deepEqual(browseDestinations(targets,{visibleIds,query}).map(body=>body.target),['Needle Galaxy']);
  assert.deepEqual(browseDestinations(targets,{visibleIds:new Set(),query:'Earth'}),[]);
  assert.ok(browseDestinations(targets,{category:'galaxy'}).length>2);
  assert.deepEqual(targets,original);
});

test('expanded worlds have bilingual sourced discovery, classified aliases and a reachable next observation', () => {
  const catalog=createCatalog({budget:'safe'}),destinations=namedDestinations(catalog);
  for(const body of catalog.bodies.filter(body=>body.id>=50041)) {
    for(const language of ['en','zh']) {
      const note=describeTarget(body.name,language),context=describeSpaceContext(body.name,language);
      assert.equal(note.bodyKind,body.kind);
      if(body.id>=50091) {assert.ok(note.representationNote);assert.equal(note.mapSourceUrl,undefined);}
      assert.ok(note.name && note.story && note.observation && note.nextReason);
      assert.equal(new URL(note.sourceUrl).protocol,'https:');
      assert.ok(context.reference && resolveCatalogTarget(catalog,note.nextTarget));
      assert.ok(browseDestinations(destinations,{category:body.kind}).some(item=>item.id===body.id));
      for(const alias of body.aliases||[]) assert.ok(searchDestinations(destinations,alias,language).some(item=>item.id===body.id));
    }
  }
});

test('white-dwarf companions have bilingual discovery and sourced reciprocal comparisons', () => {
  for(const [name,parent,queries] of [['Sirius B','Sirius',['SiriusB','天狼星 B','Alpha Canis Majoris B']],['Procyon B','Procyon',['南河三B','Alpha Canis Minoris B']]]) {
  const world = createCatalog({ budget:'safe' }), targets=namedDestinations(world), body=resolveCatalogTarget(world,name);
  for (const query of queries) {
    assert.deepEqual(browseDestinations(targets,{category:'star',query}).map(item=>item.id),[body.id]);
  }
  for (const language of ['en','zh']) {
    const note=describeTarget(body.name,language), main=describeTarget(parent,language);
    assert.equal(note.bodyKind,'star'); assert.ok(note.story && note.observation && note.nextReason);
    assert.equal(new URL(note.sourceUrl).protocol,'https:'); assert.equal(note.nextTarget,parent);
    assert.equal(main.nextTarget,body.name);
    const space=describeSpaceContext(body.name,language);
    assert.equal(space.region,'milky-way'); assert.equal(space.sourceUrl,note.sourceUrl); assert.ok(space.reference);
  }
  }
});

test('exploration routes have sourced bilingual reasons and resolve existing distinct drawn targets', () => {
  const catalog = createCatalog({ budget: 'safe' });
  const targets = namedDestinations(catalog);
  assert.equal(availableExplorationRoutes(targets).length, EXPLORATION_ROUTES.length);
  for (const route of EXPLORATION_ROUTES) {
    assert.equal(new URL(route.sourceUrl).protocol, 'https:');
    assert.equal(new Set(route.stops.map(stop => stop.target)).size, route.stops.length);
    for (const language of ['en', 'zh']) {
      const detail = describeExplorationRoute(route.key, language);
      assert.ok(detail.name && detail.context && detail.invitation);
      for (const stop of detail.stops) {
        const body = resolveCatalogTarget(catalog, stop.target);
        assert.ok(body && drawnIdentities(catalog).has(body.id));
        assert.ok(stop.prompt && describeTarget(body.name, language).sourceUrl);
      }
    }
  }
  const omitted = targets.filter(body => body.target !== EXPLORATION_ROUTES[0].stops[0].target);
  assert.ok(!availableExplorationRoutes(omitted).includes(EXPLORATION_ROUTES[0]));
  assert.deepEqual(availableExplorationRoutes([]), []);
  assert.equal(describeExplorationRoute('unknown'), null);
  assert.equal(createRouteProgress('unknown'), null);
  assert.deepEqual(describeExplorationRoute('sunlight', 'unknown'), describeExplorationRoute('sunlight', 'en'));
});

const reached = (target, id) => ({ active: target, observed: target, activeId: id, observedId: id,
  navigationState: 'observing', scaleStage: 'Surface', flight: false, systemView: null });

test('compact remnants have bilingual discovery, sourced context and explicit pulsar representation', () => {
  const world = createCatalog({ budget: 'safe' }), targets = namedDestinations(world);
  for (const [name, category, queries, region] of [
    ['Crab Pulsar', 'pulsar', ['Crab', 'PSR B0531+21', '蟹状脉冲星'], 'milky-way'],
    ['Vela Pulsar', 'pulsar', ['船帆座脉冲星', 'PSR B0833-45', 'Vela'], 'milky-way'],
    ['PSR B1509-58', 'pulsar', ['B1509', '宇宙之手脉冲星'], 'milky-way'],
    ['Geminga', 'pulsar', ['Geminga', '杰明加'], 'milky-way'],
    ['M87*', 'blackhole', ['室女座黑洞', 'Messier 87', 'Powehi'], 'outside-milky-way']
  ]) {
    for (const lang of ['zh', 'en']) {
      const detail = describeTarget(name, lang), context = describeSpaceContext(name, lang);
      assert.equal(detail.bodyKind, category); assert.equal(context.region, region);
      assert.ok(detail.story && detail.observation && detail.nextReason);
      if (category === 'pulsar') {
        assert.ok(detail.representationNote);
        assert.equal(detail.mapSourceUrl, undefined, 'illustrative thermal cores do not claim an observed surface map');
      }
      assert.equal(new URL(detail.sourceUrl).protocol, 'https:');
      assert.ok(resolveCatalogTarget(world, detail.nextTarget));
      for (const query of queries) assert.ok(searchDestinations(targets, query, lang).some(item => item.target === name));
      assert.ok(browseDestinations(targets, { category }).some(item => item.target === name));
    }
  }
});

test('new deep-sky worlds have bilingual classified discovery, sourced space context and a reachable comparison', () => {
  const world = createCatalog({ budget: 'safe' }), targets = namedDestinations(world);
  for (const [target, category, queries, region] of [
    ['Ring Nebula', 'nebula', ['环状星云', 'M 57', 'NGC-6720'], 'milky-way'],
    ['Helix Nebula', 'nebula', ['螺旋星云', 'NGC-7293', 'Caldwell 63'], 'milky-way'],
    ['Lagoon Nebula', 'nebula', ['礁湖星云', 'M 8', 'NGC-6523'], 'milky-way'],
    ["Dumbbell Nebula", "nebula", ["哑铃星云", "M27"], "milky-way"],
    ["Cat's Eye Nebula", "nebula", ["猫眼星云", "NGC6543"], "milky-way"],
    ["Butterfly Nebula", "nebula", ["蝴蝶星云", "NGC6302"], "milky-way"],
    ["Bubble Nebula", "nebula", ["气泡星云", "NGC7635"], "milky-way"],
    ["Rosette Nebula", "nebula", ["玫瑰星云", "NGC2237"], "milky-way"],
    ["Veil Nebula", "nebula", ["面纱星云", "Cygnus Loop"], "milky-way"],
    ["Flame Nebula", "nebula", ["火焰星云", "NGC2024"], "milky-way"],
    ["Swan Nebula", "nebula", ["天鹅星云", "M17"], "milky-way"],
    ['Trifid Nebula','nebula',['三裂星云','M20'],'milky-way'],
    ['Crescent Nebula','nebula',['眉月星云','C27'],'milky-way'],
    ['Tarantula Nebula','nebula',['蜘蛛星云','30 Doradus'],'outside-milky-way'],
    ['NGC 3603','nebula',['NGC3603'],'milky-way'],
    ['NGC 602','nebula',['NGC602','N90'],'outside-milky-way'],
    ['NGC 604','nebula',['NGC604'],'outside-milky-way'],
    ['Iris Nebula','nebula',['鸢尾花星云','C4'],'milky-way'],
    ['NGC 1333','nebula',['NGC1333'],'milky-way'],
    ['Ghost Nebula','nebula',['仙后座幽灵','IC63'],'milky-way'],
    ['Cone Nebula','nebula',['锥状星云','NGC2264 Cone'],'milky-way'],
    ['Red Rectangle','nebula',['红矩形星云','HD44179'],'milky-way'],
    ['Boomerang Nebula','nebula',['回力棒星云','Boomerang'],'milky-way'],
    ["Whirlpool Galaxy", "galaxy", ["涡状星系", "M51"], "outside-milky-way"],
    ["NGC 1300", "galaxy", ["NGC 1300 星系", "NGC1300"], "outside-milky-way"],
    ["Sombrero Galaxy", "galaxy", ["草帽星系", "M104"], "outside-milky-way"],
    ["Centaurus A", "galaxy", ["半人马座 A", "NGC5128"], "outside-milky-way"],
    ["Cigar Galaxy", "galaxy", ["雪茄星系", "M82"], "outside-milky-way"],
    ["Needle Galaxy", "galaxy", ["针状星系", "NGC4565"], "outside-milky-way"],
    ["Messier 49", "galaxy", ["梅西耶 49", "M49"], "outside-milky-way"],
    ["Cartwheel Galaxy", "galaxy", ["车轮星系", "Cartwheel"], "outside-milky-way"],
    ['Triangulum Galaxy', 'galaxy', ['三角座星系', 'M 33', 'NGC-598'], 'outside-milky-way'],
  ]) {
    const body = resolveCatalogTarget(world, target);
    for (const query of queries) assert.deepEqual(browseDestinations(targets, { category, query }).map(item => item.id), [body.id]);
    for (const language of ['en', 'zh']) {
      const note = describeTarget(target, language), context = describeSpaceContext(target, language);
      assert.equal(note.bodyKind, category); assert.ok(note.story && note.observation && note.nextReason);
      assert.equal(new URL(note.sourceUrl).protocol, 'https:'); assert.ok(resolveCatalogTarget(world, note.nextTarget));
      assert.equal(context.region, region); assert.equal(context.sourceUrl, note.sourceUrl); assert.ok(context.reference);
    }
  }
});

test('new Kuiper worlds are searchable in both languages with separate classifications and map attribution', () => {
  const world = createCatalog({ budget: 'safe' }), targets = namedDestinations(world);
  for (const [target, category, query] of [['Pluto', 'dwarfplanet', '冥王星'], ['Charon', 'moon', '卡戎'], ['Ceres','dwarfplanet','谷神星'], ['Vesta','asteroid','灶神星'], ['Ariel','moon','天卫一'], ['Umbriel','moon','天卫二'], ['Titania','moon','天卫三'], ['Oberon','moon','天卫四']]) {
    const body = resolveCatalogTarget(world, target);
    assert.deepEqual(browseDestinations(targets, { category, query }).map(item => item.id), [body.id]);
    assert.ok(!browseDestinations(targets, { category: 'planet' }).some(item => item.id === body.id));
    for (const language of ['en', 'zh']) {
      const note = describeTarget(target, language);
      assert.equal(note.bodyKind, category); assert.ok(note.story && note.observation && note.mapSourceLabel);
      assert.equal(new URL(note.mapSourceUrl).protocol, 'https:');
      assert.equal(describeSpaceContext(target, language).region, 'solar-system');
    }
  }
});

test('the next route observation carries the requested language without changing its target', () => {
  for (const route of EXPLORATION_ROUTES) {
    const progress = rememberRouteObservation(createRouteProgress(route.key), reached(route.stops[0].target, 0));
    for (const language of ['en', 'zh']) {
      const next = nextRouteStop(progress, language);
      assert.equal(next.target, route.stops[1].target);
      assert.equal(next.prompt, describeExplorationRoute(route.key, language).stops[1].prompt);
    }
    assert.notEqual(nextRouteStop(progress, 'en').prompt, nextRouteStop(progress, 'zh').prompt);
    assert.deepEqual(nextRouteStop(progress, 'unknown'), nextRouteStop(progress, 'en'));
  }
});

test('route progress counts actual centred close observations once and leaves its input unchanged', () => {
  const progress = createRouteProgress('sunlight');
  const arrived = rememberRouteObservation(progress, reached('Sol', 0));
  assert.deepEqual(progress.visited, []);
  assert.deepEqual(arrived.visited, ['Sol']);
  assert.equal(rememberRouteObservation(arrived, reached('Sol', 0)), arrived);
  assert.equal(nextRouteStop(arrived).target, 'Earth');
  assert.equal(rememberRouteObservation(arrived, reached('Crab Pulsar', 50008)), arrived);
});

test('intended arrivals, stopped crossings, map views and family overviews do not complete route stops', () => {
  const progress = createRouteProgress('sunlight');
  const view = reached('Earth', 50000);
  for (const change of [{ flight: true }, { observed: 'Sol', observedId: 0 }, { active: 'Mars' },
    { navigationState: 'paused' }, { navigationState: 'returning' }, { scaleStage: 'Galactic' },
    { scaleStage: 'LocalMap' }, { observedId: undefined, activeId: undefined }, { systemView: { visible: true } }]) {
    assert.equal(rememberRouteObservation(progress, { ...view, ...change }), progress);
  }
  assert.equal(rememberRouteObservation(progress, null), progress);
});

test('a free detour can return to the route and out-of-order stops remain bounded', () => {
  let progress = createRouteProgress('sunlight');
  progress = rememberRouteObservation(progress, reached('Moon', 50003));
  const detour = rememberRouteObservation(progress, reached('Mars', 50004));
  assert.equal(detour, progress);
  assert.equal(nextRouteStop(progress).target, 'Sol');
  for (const stop of describeExplorationRoute('sunlight').stops) {
    const identity = { Sol: 0, Earth: 50000, Moon: 50003, "Halley's Comet": 50006 }[stop.target];
    progress = rememberRouteObservation(progress, reached(stop.target, identity));
  }
  assert.equal(progress.visited.length, describeExplorationRoute('sunlight').stops.length);
  assert.equal(nextRouteStop(progress), null);
  const other = createRouteProgress('stellar-stories');
  assert.deepEqual(other.visited, []);
  assert.ok(nextRouteStop(other));
});

const drawnIdentities = catalog => new Set([...catalog.drawIndices, ...catalog.bodies.map(body => body.id)]);

test('editorial destinations resolve to drawn catalog identities with sourced bilingual information', () => {
  const catalog = createCatalog({ budget: 'safe' });
  const identities = new Set();
  for (const destination of TARGET_NOTES) {
    const star = resolveCatalogTarget(catalog, destination.target);
    assert.ok(star);
    assert.ok(drawnIdentities(catalog).has(star.id));
    assert.ok(!identities.has(star.id));
    identities.add(star.id);
    assert.equal(new URL(destination.sourceUrl).protocol, 'https:');
    if (destination.mapSourceUrl) {
      assert.equal(new URL(destination.mapSourceUrl).protocol, 'https:');
      assert.ok(destination.mapSourceLabel);
    }
    if (destination.shapeSourceUrl) {
      assert.equal(new URL(destination.shapeSourceUrl).protocol, 'https:');
      assert.ok(destination.shapeSourceLabel);
      for (const language of ['en','zh']) assert.equal(describeTarget(star.name,language).shapeSourceUrl,destination.shapeSourceUrl);
    }
    if (destination.observationSourceUrl) {
      assert.equal(new URL(destination.observationSourceUrl).protocol, 'https:');
      assert.ok(destination.observationSourceLabel);
    }
    for (const language of ['en', 'zh']) {
      const detail = describeTarget(star.name, language);
      if (destination.mapSourceUrl) {
        assert.equal(detail.mapSourceUrl, destination.mapSourceUrl);
        assert.equal(detail.mapSourceLabel, destination.mapSourceLabel);
      }
      assert.equal(detail.kind, 'named');
      assert.equal(detail.target, star.name);
      assert.equal(detail.bodyKind, star.kind);
      for (const field of ['name', 'type', 'fact', 'invitation', 'story', 'observation', 'sourceLabel']) assert.ok(detail[field]);
    }
  }
});

test('observation recommendations have reasons and lead to distinct drawn catalog targets', () => {
  const catalog = createCatalog({ budget: 'safe' });
  for (const note of TARGET_NOTES) {
    const next = resolveCatalogTarget(catalog, note.nextTarget);
    assert.ok(next && next.name !== note.target);
    assert.ok(drawnIdentities(catalog).has(next.id));
    for (const language of ['en', 'zh']) assert.ok(describeTarget(note.target, language).nextReason);
  }
  assert.equal(describeTarget('UO 01234').nextTarget, undefined);
  assert.equal(describeTarget('Tau Ceti').nextTarget, undefined);
});

test('generated notes do not invent a source or scientific measurements', () => {
  for (const language of ['en', 'zh']) {
    const generated = describeTarget('UO 01234', language);
    assert.equal(generated.kind, 'procedural');
    assert.equal(generated.name, 'UO 01234');
    assert.equal(generated.sourceUrl, undefined);
    const named = describeTarget('Vega', language);
    assert.equal(named.kind, 'named');
    assert.equal(describeTarget('Sol', 'unknown').name, describeTarget('Sol', 'en').name);
  }
});

test('scientific space context distinguishes galactic membership and stays separate from simulated coordinates', () => {
  const catalog = createCatalog({ catalog: 50000, seed: 87, budget: 'safe' });
  for (const language of ['en', 'zh']) {
    for (const note of TARGET_NOTES) {
      const context = describeSpaceContext(note.target, language);
      if (!context) continue;
      assert.ok(resolveCatalogTarget(catalog, note.target));
      assert.ok(context.path && context.sourceLabel);
      assert.equal(new URL(context.sourceUrl).protocol, 'https:');
    }
    assert.equal(describeSpaceContext('Andromeda Galaxy', language).region, 'outside-milky-way');
    assert.equal(describeSpaceContext('Orion Nebula', language).region, 'milky-way');
    for (const target of ['Sol', 'Mercury', 'Venus', 'Earth', 'Saturn', 'Mars', 'Jupiter', 'Uranus', 'Neptune', 'Moon', "Halley's Comet"]) {
      assert.equal(describeSpaceContext(target, language).region, 'solar-system');
    }
    assert.ok(describeSpaceContext('Andromeda Galaxy', language).reference);
    assert.ok(describeSpaceContext('Orion Nebula', language).reference);
    assert.equal(describeSpaceContext('UO 01234', language), null);
    assert.equal(describeSpaceContext('Tau Ceti', language), null);
  }
  assert.deepEqual(describeSpaceContext('Sol', 'unknown'), describeSpaceContext('Sol', 'en'));
});

test('observation scale names cover every stage and adapt to extended bodies without changing stage identities', () => {
  const stages = ['Galactic', 'Regional', 'LocalMap', 'LocalSystem', 'Surface'];
  for (const language of ['en', 'zh']) {
    for (const kind of ['star', 'planet', 'moon', 'comet', 'pulsar', 'blackhole', 'nebula', 'galaxy']) {
      const names = stages.map(stage => describeObservationScale(stage, kind, language));
      assert.ok(names.every(name => typeof name === 'string' && name.length > 0));
      assert.equal(new Set(names).size, stages.length);
    }
    for (const kind of ['comet', 'pulsar', 'blackhole', 'nebula', 'galaxy']) {
      assert.notEqual(describeObservationScale('LocalSystem', kind, language), describeObservationScale('LocalSystem', 'star', language));
    }
    assert.notEqual(describeObservationScale('Surface', 'nebula', language, true), describeObservationScale('Surface', 'nebula', language, false));
    assert.equal(describeObservationScale('Surface', 'planet', language, true), describeObservationScale('Surface', 'planet', language, false));
  }
  assert.equal(describeObservationScale('LocalSystem', 'unknown'), describeObservationScale('LocalSystem', 'star'));
  assert.equal(describeObservationScale('Surface', 'galaxy', 'unknown'), describeObservationScale('Surface', 'galaxy', 'en'));
});

test('searchable destinations remain catalog identities and do not grow with generated catalog size', () => {
  const small = createCatalog({ catalog: 1000, seed: 23, budget: 'safe' });
  const large = createCatalog({ catalog: 50000, seed: 87, budget: 'safe' });
  const targets = namedDestinations(small);
  assert.deepEqual(namedDestinations(large), targets);
  assert.equal(new Set(targets.map(item => item.id)).size, targets.length);
  for (const item of targets) {
    assert.equal(resolveCatalogTarget(small, item.target)?.id, item.id);
    assert.equal(item.bodyKind, resolveCatalogTarget(small, item.target)?.kind);
    assert.ok(drawnIdentities(small).has(item.id));
    assert.equal(describeTarget(item.target).kind, 'named');
  }
});

test('browsing reveals every named body in its catalog category without changing identity or the starting selection', () => {
  const catalog = createCatalog({ catalog: 50000, seed: 23, budget: 'safe' });
  const targets = namedDestinations(catalog);
  assert.deepEqual(browseDestinations(targets).map(item => item.target), DESTINATIONS.map(item => item.target));
  const seen = new Set();
  for (const category of DESTINATION_CATEGORIES.filter(key => key !== 'featured')) {
    const bodies = browseDestinations(targets, { category });
    assert.ok(bodies.length > 0);
    for (const body of bodies) {
      assert.equal(resolveCatalogTarget(catalog, body.target).kind, category);
      assert.ok(targets.includes(body));
      assert.ok(!seen.has(body.id));
      seen.add(body.id);
    }
  }
  assert.deepEqual(seen, new Set(targets.map(body => body.id)));
  assert.ok(browseDestinations(targets, { category: 'planet' }).some(body => body.target === 'Mars'));
  assert.ok(browseDestinations(targets, { category: 'planet' }).some(body => body.target === 'Jupiter'));
  assert.ok(browseDestinations(targets, { category: 'moon' }).some(body => body.target === 'Moon'));
});

test('category search composes with bilingual aliases and keeps global search available from the starting selection', () => {
  const targets = namedDestinations(createCatalog({ budget: 'safe' }));
  for (const [category, queries, expected] of [
    ['planet', ['水星', ' mErCuRy '], 'Mercury'], ['planet', ['金星', ' vEnUs '], 'Venus'],
    ['planet', ['天王星', ' uRaNuS '], 'Uranus'], ['planet', ['海王星', ' nEpTuNe '], 'Neptune'],
    ['planet', ['火星', ' mArs '], 'Mars'], ['planet', ['木星', ' jUpItEr '], 'Jupiter'], ['moon', ['月球', 'luna'], 'Moon'],
    ['moon', ['木卫一',' Io '], 'Io'], ['moon', ['木卫二','eUrOpA'], 'Europa'],
    ['moon', ['木卫三','gAnYmEdE'], 'Ganymede'], ['moon', ['木卫四','CALLISTO'], 'Callisto'],
    ['moon', ['土卫二','eNcElAdUs'], 'Enceladus'], ['moon', ['土卫六',' tItAn '], 'Titan'],
    ['moon', ['天卫一','aRiEl'], 'Ariel'], ['moon', ['天卫二','uMbRiEl'], 'Umbriel'],
    ['moon', ['天卫三','tItAnIa'], 'Titania'], ['moon', ['天卫四','oBeRoN'], 'Oberon'],
    ['moon', ['天卫五','mIrAnDa'], 'Miranda'], ['moon', ['土卫八','iApEtUs'], 'Iapetus'],
    ['moon', ['火卫一','pHoBoS'], 'Phobos'], ['moon', ['火卫二','dEiMoS'], 'Deimos'],
    ['moon', ['海卫一','tRiToN'], 'Triton'], ['moon', ['土卫一',' MiMaS '], 'Mimas'],
    ['galaxy', ['仙女座', 'M 31'], 'Andromeda Galaxy'], ['nebula', ['猎户座', 'NGC-1976'], 'Orion Nebula'],
    ['comet', ['哈雷', '1P/Halley'], "Halley's Comet"],
    ['pulsar', ['蟹状', 'psr b0531+21', 'CRAB'], 'Crab Pulsar'],
    ['blackhole', ['黑洞', '射手座', '银河中心', 'sgr a*', 'Sagittarius A'], 'Sagittarius A*']
  ]) {
    for (const query of queries) {
      assert.deepEqual(browseDestinations(targets, { category, query }).map(body => body.target), [expected]);
      assert.ok(browseDestinations(targets, { query }).some(body => body.target===expected));
    }
  }
  assert.equal(browseDestinations(targets, { category: 'moon', query: 'Mars' }).length, 0);
  assert.deepEqual(browseDestinations(targets, { category: 'invalid' }), browseDestinations(targets));
  assert.deepEqual(browseDestinations(targets, { category: 'moon', query: '  ' }), browseDestinations(targets, { category: 'moon' }));
});

test('body search accepts canonical names, case, punctuation and known bilingual aliases', () => {
  const targets = namedDestinations(createCatalog({ budget: 'safe' }));
  assert.deepEqual(searchDestinations(targets, ' vEgA ').map(item => item.target), ['Vega']);
  assert.deepEqual(searchDestinations(targets, '织女').map(item => item.target), ['Vega']);
  assert.deepEqual(searchDestinations(targets, '地球').map(item => item.target), ['Earth']);
  assert.deepEqual(searchDestinations(targets, '土星').map(item => item.target), ['Saturn']);
  for (const alias of ['火星', ' mArs ']) {
    assert.deepEqual(searchDestinations(targets, alias).map(item => item.target), ['Mars']);
  }
  for (const alias of ['月球', 'luna', 'MOON']) {
    assert.deepEqual(searchDestinations(targets, alias).map(item => item.target), ['Moon']);
  }
  for (const alias of ['猎户座大星云', 'M 42', 'ngc-1976', 'ORION nebula']) {
    assert.deepEqual(searchDestinations(targets, alias).map(item => item.target), ['Orion Nebula']);
  }
  for (const alias of ['仙女座', 'M 31', 'NGC-224', 'ANDROMEDA']) {
    assert.deepEqual(searchDestinations(targets, alias).map(item => item.target), ['Andromeda Galaxy']);
  }
  assert.deepEqual(searchDestinations(targets, '太阳').map(item => item.target), ['Sol']);
  assert.deepEqual(searchDestinations(targets, '比邻').map(item => item.target), ['Proxima Centauri']);
  assert.deepEqual(searchDestinations(targets, 'barnards').map(item => item.target), ["Barnard's Star"]);
  assert.equal(searchDestinations(targets, 'not a catalog star').length, 0);
});


test('unknown small-world appearance has a bilingual source-backed note for saved observations', () => {
  for(const language of ['en','zh']) {
    const note=describeTarget('Psyche',language);
    assert.ok(note.representationNote && note.story && note.observation);
    assert.equal(new URL(note.sourceUrl).hostname,'science.nasa.gov');
  }
  assert.equal(describeTarget('UO 01234').representationNote,undefined);
});

test('every finite named destination has a primary identity source in both languages', () => {
  for (const target of namedDestinations(createCatalog({budget:'safe'}))) {
    for (const language of ['en','zh']) {
      const detail=describeTarget(target.target,language);
      assert.equal(detail.kind,'named');
      assert.equal(new URL(detail.sourceUrl).protocol,'https:',target.target);
      assert.ok(detail.sourceLabel,target.target);
    }
  }
  assert.equal(describeTarget('UO 01001').kind,'procedural');
  assert.equal(describeTarget('UO 01001').sourceUrl,undefined);
});

test('space-scoped discovery follows actual membership through category and bilingual search', () => {
  const targets=namedDestinations(createCatalog({budget:'safe'}));
  const outside=browseDestinations(targets,{region:'outside-milky-way'});
  assert.equal(outside.filter(x=>x.bodyKind==='galaxy').length,26);
  for (const name of ['M87*','Tarantula Nebula','NGC 602','NGC 604']) assert.ok(outside.some(x=>x.target===name));
  assert.ok(!outside.some(x=>['Sol','Earth','Orion Nebula'].includes(x.target)));
  for (const category of DESTINATION_CATEGORIES.filter(x=>x!=='featured')) {
    const all=browseDestinations(targets,{category});
    const inside=browseDestinations(targets,{category,region:'milky-way'});
    const external=browseDestinations(targets,{category,region:'outside-milky-way'});
    assert.deepEqual([...inside,...external].map(x=>x.id).sort((a,b)=>a-b),all.map(x=>x.id).sort((a,b)=>a-b));
  }
  for (const query of ['蜘蛛星云','30 Doradus','Tarantula Nebula'])
    assert.deepEqual(browseDestinations(targets,{region:'outside-milky-way',category:'nebula',query}).map(x=>x.target),['Tarantula Nebula']);
});
