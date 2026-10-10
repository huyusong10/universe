import { GALAXY_EXPLORATIONS } from './observatory-galaxies.js?v=cosmic-explore-20261010gu';
import { NEBULA_EXPLORATIONS } from './observatory-nebulae.js?v=cosmic-explore-20261010gu';
import { EXOWORLDS, EXOSYSTEMS } from './observatory-exoworlds.js?v=cosmic-explore-20261010gu';
// Editorial destinations use catalog names, never a second set of identities.
// Scientific notes are separate from the compressed, procedural scene geometry.
const ANDROMEDA_SOURCE_URL = 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/';
export const DESTINATIONS = [
  {
    key: 'helix-nebula', target: 'Helix Nebula', aliases: ['NGC7293', 'Caldwell 63', 'C63'], bodyKind: 'nebula',
    spaceRegion: 'milky-way', spaceSource: 'body', nextTarget: 'Ring Nebula', color: '#e9a268', sourceLabel: 'NASA / Hubble',
    sourceUrl: 'https://science.nasa.gov/asset/hubble/comet-like-knots-around-a-dying-star-in-the-helix-nebula/',
    en: {
      name: 'Helix Nebula', type: 'Planetary nebula · NGC 7293', fact: 'Gas shed by an aging star',
      spaceReference: 'In Aquarius, within the Milky Way', invitation: 'Look through a porous shell and follow its small gas knots.',
      story: 'The Helix is gas released late in a star’s life. Hubble observations reveal many comet-like knots along the inner edge, with bright heads and faint tails. They are gas structures, not comets or planets. The shells, knot arrangement, central light, colours, motion, position and compressed size here are procedural illustrations, not a telescope image or measured three-dimensional reconstruction.',
      observation: 'Orbit to see the outer arc separate from the inner collar. Approach through the opening, follow the irregular rim and withdraw to recover the full shell.',
      nextReason: 'Compare two planetary nebulae: a broad porous collar and the narrower ring of M57.'
    },
    zh: {
      name: '螺旋星云', type: '行星状星云 · NGC 7293', fact: '恒星晚期释放的气体',
      spaceReference: '银河系内 · 宝瓶座方向', invitation: '穿过疏松壳层的开口，寻找其中的小气结。',
      story: '螺旋星云来自恒星生命晚期释放的气体。哈勃观测发现内缘有许多彗星状气结，带有亮头和淡尾；它们是气体结构，不是彗星或行星。这里的壳层、气结排列、中央亮点、颜色、活动、位置与压缩尺寸均为程序示意，并非望远镜图像或实测三维重建。',
      observation: '环视让外侧弧层与内侧宽环分开，再穿过开口接近不规则环壁。退离后恢复完整壳层。',
      nextReason: '比较两种行星状星云：疏松宽环与 M57 较紧凑的环。'
    }
  }, {
    key: 'lagoon-nebula', target: 'Lagoon Nebula', aliases: ['M8', 'Messier 8', 'NGC6523'], bodyKind: 'nebula',
    spaceRegion: 'milky-way', spaceSource: 'body', nextTarget: 'Orion Nebula', color: '#cf86b5', sourceLabel: 'ESA / Hubble',
    sourceUrl: 'https://esahubble.org/news/heic1517/',
    en: {
      name: 'Lagoon Nebula', type: 'Stellar nursery · M8', fact: 'Young stars sculpt gas and dark dust',
      spaceReference: 'In Sagittarius, within the Milky Way', invitation: 'Follow a dark dust channel toward an illuminated cavity.',
      story: 'A broad dust lane crosses the Lagoon Nebula. In its central region, the young star Herschel 36 ionises and sculpts nearby gas; wispy structures connect larger clouds where new stars form. The dust channel, pillars, cavity, embedded lights, colours, activity, position and compressed scale here are procedural interpretations, not a reconstruction or a view of current weather.',
      observation: 'Orbit the two cloud banks, enter beside the dark channel and inspect the luminous cavity wall. Pause to compare foreground dust with the lights beyond it.',
      nextReason: 'Compare two stellar nurseries and the cavities young stars carve into their clouds.'
    },
    zh: {
      name: '礁湖星云', type: '恒星诞生的云 · M8', fact: '年轻恒星塑造气体与暗尘',
      spaceReference: '银河系内 · 人马座方向', invitation: '循着暗尘通道，接近被星光照亮的空腔。',
      story: '宽阔尘埃带横穿礁湖星云。中央区域的年轻恒星 Herschel 36 电离并塑造周围气体；较大云团之间连接着细丝，新恒星仍在其中形成。这里的暗尘通道、柱体、空腔、内部亮点、颜色、活动、位置和压缩比例均为程序表达，并非观测数据重建或当前天气。',
      observation: '环视两侧云岸，沿暗尘通道进入，观察空腔的发光壁。暂停比较前景暗尘与更远的星光。',
      nextReason: '比较两处恒星育婴室，以及年轻恒星在云中雕出的空腔。'
    }
  },
  {
    key: 'andromeda', target: 'Andromeda Galaxy', aliases: ['M31', 'NGC224', 'Andromeda', 'Messier 31'], bodyKind: 'galaxy', spaceRegion: 'outside-milky-way', nextTarget: 'Orion Nebula', color: '#d9c29d', sourceLabel: 'NASA / Hubble',
    sourceUrl: ANDROMEDA_SOURCE_URL,
    en: {
      name: 'Andromeda Galaxy', type: 'Spiral galaxy · M31', fact: 'A neighbouring galaxy · About 2.5 million light-years away',
      spaceReference: 'About 2.5 million light-years from Earth',
      invitation: 'Approach a galaxy and see its disc open into depth.',
      story: 'Andromeda has a bright central bulge, a broad stellar disc and dark dust lanes. Hubble reveals blue star clusters within its arms. The structure here is procedural: positions, scale and individual lights are artistic representations, not a photograph or a measured star catalogue.',
      observation: 'Orbit from above the disc toward its edge. Move closer to follow the dark lanes and local starlight; withdraw to recover the whole structure.',
      nextReason: 'Return to the Milky Way and explore a smaller cloud where stars form.'
    },
    zh: {
      name: '仙女座星系', type: '旋涡星系 · M31', fact: '邻近的星系 · 距离约 250 万光年',
      spaceReference: '距地球约 250 万光年',
      invitation: '接近一座星系，看盘面展开为空间。',
      story: '仙女座拥有明亮的中央隆起、广阔的恒星盘与暗尘通道。哈勃在旋臂中揭示了蓝色星团。这里的结构由程序生成；位置、尺度与局部星光均为艺术化表达，并非照片或测量恒星目录。',
      observation: '从盘面上方环视到侧缘，靠近寻找暗尘与局部星光；退离后重新辨认完整结构。',
      nextReason: '回到银河系，观察尺度更小、孕育恒星的发光云。'
    }
  },
  {
    "key": "ring-nebula",
    "target": "Ring Nebula",
    "aliases": [
      "M57",
      "NGC6720",
      "Messier 57"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Orion Nebula",
    "color": "#78d3cd",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-57/",
    "en": {
      "name": "Ring Nebula",
      "type": "Planetary nebula · M57",
      "fact": "Glowing remains of a sun-like star",
      "spaceReference": "About 2,000 light-years from Earth",
      "invitation": "Orbit a glowing ring and discover the gas within it.",
      "story": "A hot white dwarf illuminates gas shed by the former star. The bright main ring surrounds blue inner lobes, with dense irregular knots along its inner rim. Planetary nebulae are not planets. This three-dimensional shell, colours, knots, central light, slow activity and compressed scale are procedural illustrations, not a telescope image or measured reconstruction.",
      "observation": "Orbit from the ring face to its side, then approach the inner gas and filamented rim. Pause to inspect the depth; withdraw to recover the whole shell.",
      "nextReason": "Compare gas left by a dying star with a cloud where new stars form."
    },
    "zh": {
      "name": "环状星云",
      "type": "行星状星云 · M57",
      "fact": "类太阳恒星留下的发光气体",
      "spaceReference": "距地球约 2,000 光年",
      "invitation": "环视发光的环，发现其中仍有气体。",
      "story": "炽热白矮星照亮此前恒星抛出的气体。明亮主环围绕蓝色内侧气体，两端伸出环外，内缘嵌有不规则致密气结。行星状星云不是行星。这里的三维壳层、颜色、气结、中央亮点、放慢的活动和压缩尺度均为程序示意，并非望远镜图像或测量重建。",
      "observation": "从环面环视到侧缘，再接近内侧气体与带丝纹的环壁。暂停观察纵深，退离后恢复完整壳层。",
      "nextReason": "比较恒星晚期留下的气体，与正在孕育新恒星的云。"
    }
  },
  {
    "key": "triangulum",
    "target": "Triangulum Galaxy",
    "aliases": [
      "M33",
      "NGC598",
      "Triangulum",
      "Messier 33"
    ],
    "bodyKind": "galaxy",
    "spaceRegion": "outside-milky-way",
    "spaceSource": "body",
    "nextTarget": "Andromeda Galaxy",
    "color": "#94b9e9",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/",
    "en": {
      "name": "Triangulum Galaxy",
      "type": "Spiral galaxy · M33",
      "fact": "A disc rich in young stars and glowing gas",
      "spaceReference": "About 3 million light-years from Earth",
      "invitation": "Follow loose blue arms through a different kind of galactic disc.",
      "story": "Triangulum is a spiral galaxy beyond the Milky Way. It lacks a central bulge, and its disc contains many young stellar regions and glowing clouds of gas. The loose arms, dust, pink regions, individual lights, rotation and scale here are procedural artistic illustrations, not the Hubble mosaic or a measured stellar catalogue.",
      "observation": "Follow the looser arms and scattered pink star-forming regions. Continue closer to local starlight, orbit the disc edge, then withdraw to see the whole galaxy.",
      "nextReason": "Compare this dispersed disc with Andromeda’s bright central bulge and tightly wound lanes."
    },
    "zh": {
      "name": "三角座星系",
      "type": "旋涡星系 · M33",
      "fact": "年轻恒星与发光气体丰富的盘面",
      "spaceReference": "距地球约 300 万光年",
      "invitation": "沿疏松的蓝色旋臂，进入另一种星系盘面。",
      "story": "三角座是银河系外的旋涡星系，没有中央隆起，盘面中有丰富的年轻恒星区域和发光气体云。这里较松散的旋臂、暗尘、粉色星区、局部星光、转动与尺度均为程序艺术示意，并非哈勃镶嵌图或测量恒星目录。",
      "observation": "沿较松散的旋臂寻找分散的粉色恒星形成区域，继续接近局部星光、环视盘面侧缘，再退离辨认完整星系。",
      "nextReason": "与仙女座明亮的中央隆起和较紧密的暗尘通道对照。"
    }
  },
  {
    key: 'sol', target: 'Sol', spaceRegion: 'solar-system', nextTarget: 'Betelgeuse', color: '#f3cf83', sourceLabel: 'NASA',
    sourceUrl: 'https://science.nasa.gov/sun/facts/',
    en: {
      name: 'Sun', type: 'Our home star', fact: 'Light reaches Earth in about 8 minutes',
      invitation: 'Begin with the star that makes our world possible.',
      story: 'The Sun is a living sphere of hot plasma. Its visible surface is the photosphere; above it stretches the much hotter corona.',
      observation: 'Follow bright cells and their cooler channels into the roots of growing coronal arcs. Pause, orbit or move closer. Structure, motion and visible colours are artistic illustrations.',
      nextReason: 'From our familiar star to a red supergiant late in its life.'
    },
    zh: {
      name: '太阳', type: '我们的恒星', fact: '阳光约 8 分钟抵达地球',
      invitation: '从让我们的世界成为可能的那颗恒星出发。',
      story: '太阳是一颗炽热的等离子体球。我们看到的是光球层，其外延伸着温度更高的日冕。',
      observation: '沿亮胞与较暗通道寻找日冕弧的根部，停留看弧束生长与向外流动；暂停、环视或继续靠近。结构、可见颜色与动态为艺术化示意。',
      nextReason: '从熟悉的太阳，去看生命晚期的红超巨星。'
    }
  },
  {
    key: 'earth', target: 'Earth', bodyKind: 'planet', spaceRegion: 'solar-system', nextTarget: 'Mars', color: '#6baff5', sourceLabel: 'NASA',
    sourceUrl: 'https://science.nasa.gov/earth/facts/',
    en: {
      name: 'Earth', type: 'Terrestrial planet', fact: 'Our ocean world · Third planet from the Sun',
      invitation: 'Look back at home, suspended in the sunlight.',
      story: 'Earth has a rocky surface and vast oceans of liquid water. Its atmosphere supports clouds and weather. Geography uses NASA’s July 2004 Blue Marble composite, with a historical NASA cloud mosaic. Cloud motion, atmosphere and lighting are artistic, not current weather.',
      observation: 'Orbit to find the boundary between day and night, and watch clouds cross the continents.',
      nextReason: 'Compare our ocean world with a rocky desert shaped by a wetter past.'
    },
    zh: {
      name: '地球', type: '岩石行星', fact: '我们的海洋世界 · 太阳的第三颗行星',
      invitation: '回望阳光中悬浮的家园。',
      story: '地球拥有岩石地表和广阔的液态水海洋，大气中有云层与天气。大陆来自 NASA 2004 年 7 月 Blue Marble 合成底图，云系使用 NASA 历史观测拼图。云层移动、大气与光照为艺术化表达，不是当前天气。',
      observation: '环视寻找昼夜交界，观察云层掠过大陆。',
      nextReason: '从海洋世界，去看留有湿润往昔痕迹的岩石荒漠。'
    }
  },
  {
    key: 'saturn', target: 'Saturn', bodyKind: 'planet', spaceRegion: 'solar-system', nextTarget: 'Earth', color: '#d3bd8a', sourceLabel: 'NASA',
    sourceUrl: 'https://science.nasa.gov/saturn/facts/',
    observationSourceLabel: 'NASA · Cassini', observationSourceUrl: 'https://science.nasa.gov/mission/cassini/science/saturn/hexagon-in-motion/',
    en: {
      name: 'Saturn', type: 'Ringed gas giant', fact: 'Sixth planet from the Sun · No solid surface',
      invitation: 'Fly toward the world whose rings change with your viewpoint.',
      story: 'Saturn is mostly hydrogen and helium. Its rings contain countless pieces of ice and rock, separated into bands with gaps. This scene artistically represents its cloud tops and rings; it is not a landing surface.',
      observation: 'Follow fine cloud banks, then orbit toward the north polar hexagon and its central vortex. Compare the rings, gaps and shadows from above and below.',
      representationNote: 'Authored cloud tops and an enlarged north polar hexagon; colour, cloud relief and motion are illustrations, not Cassini imagery or current weather.',
      nextReason: 'Return to Earth to compare a solid ocean world with this gas giant.'
    },
    zh: {
      name: '土星', type: '有环的气态巨行星', fact: '太阳的第六颗行星 · 没有固体表面',
      invitation: '接近一个环带随视角展开的世界。',
      story: '土星主要由氢和氦构成。无数冰块与岩石组成分层、有缝隙的环带。这里以艺术化方式呈现云顶和环带，并非可着陆的地表。',
      observation: '沿细云岸靠近，再环视北极六边形云带与中央涡旋；从上下方比较环带、间隙与投影。',
      representationNote: '云顶与放大的北极六边形为艺术创作；色彩、云层起伏和活动不是卡西尼图像或当前天气。',
      nextReason: '回到地球，对照固体的海洋世界与气态巨行星。'
    }
  },
  {
    key: 'orion', target: 'Orion Nebula', aliases: ['M42', 'NGC1976'], bodyKind: 'nebula', spaceRegion: 'milky-way', spaceSource: 'body', nextTarget: 'Sol', color: '#ec83ac', sourceLabel: 'NASA / JPL',
    sourceUrl: 'https://www.jpl.nasa.gov/news/nasa-space-telescopes-provide-a-3-d-journey-through-the-orion-nebula/',
    en: {
      name: 'Orion Nebula', type: 'Stellar nursery', fact: 'M42 · Gas and dust where stars are born',
      spaceReference: 'About 1,350 light-years from Earth',
      invitation: 'Enter a luminous cloud and discover a different kind of cosmic landscape.',
      story: 'Young stars illuminate the Orion Nebula. Radiation and stellar winds from its central Trapezium stars carve a cavity in the surrounding gas and dust. The clouds, colours and embedded lights here are an artistic volume, not a reconstruction of telescope data.',
      observation: 'Move closer into the cloud. Orbit to see luminous layers, dark dust and the embedded lights shift against one another.',
      nextReason: 'From a stellar nursery to the star that sustains our world.'
    },
    zh: {
      name: '猎户座大星云', type: '恒星诞生的云', fact: 'M42 · 新恒星在气体与尘埃中诞生',
      spaceReference: '距地球约 1,350 光年',
      invitation: '进入发光的云，发现另一种宇宙景观。',
      story: '年轻恒星照亮了猎户座大星云。中央四边形星团的辐射与恒星风，在周围气体和尘埃中雕出空腔。这里的云层、色彩与核心星光是艺术化体积，并非望远镜数据的三维重建。',
      observation: '继续靠近进入云中。环视发光云层、暗尘与核心星光，看它们随视角产生位置变化。',
      nextReason: '从恒星诞生的地方，回到维系我们世界的太阳。'
    }
  },
  {
    key: 'proxima', target: 'Proxima Centauri', aliases: ['Proxima','比邻'], spaceRegion: 'milky-way', nextTarget: 'Proxima Centauri b', color: '#ed9472', sourceLabel: 'ESO',
    sourceUrl: 'https://www.eso.org/public/news/eso1629/',
    en: {
      name: 'Proxima Centauri', type: 'Red dwarf', fact: 'About 4.2 light-years from the Sun',
      invitation: 'Meet our nearest stellar neighbour beyond the Sun.',
      story: 'Our nearest neighbouring star is a small, cool red dwarf. Despite being so close, it is too faint to see with the unaided eye.',
      observation: 'Approach the warm thermal layers, then open the shared space and visit Proxima b. Surface colours and slowed activity are authored, not a measured flare event.',
      nextReason: 'Visit the planet orbiting this red dwarf and compare reflected light with the host’s emission.'
    },
    zh: {
      name: '比邻星', type: '红矮星', fact: '距太阳约 4.2 光年',
      invitation: '拜访太阳之外，离我们最近的恒星。',
      story: '离太阳最近的邻居是一颗小而较冷的红矮星。虽然距离近，它的光仍然微弱到无法用肉眼看见。',
      observation: '接近暖色热层，再展开共同空间拜访比邻星 b。表面色彩与放慢的活动是作者示意，不是实测耀斑。',
      nextReason: '拜访环绕这颗红矮星的行星，比较反射光与主星自身的发光。'
    }
  },
  {
    key: 'sirius', target: 'Sirius', spaceRegion: 'milky-way', nextTarget: 'Sirius B', color: '#b1d7ff', sourceLabel: 'ESA / Hubble',
    sourceUrl: 'https://esahubble.org/news/heic0516/',
    en: {
      name: 'Sirius', type: 'Brightest star in our night sky', fact: 'About 8.6 light-years from Earth',
      invitation: 'Approach the brilliant point that leads our night sky.',
      story: 'Sirius is a nearby binary. Its blue-white main star and much smaller white dwarf companion can both be explored here. Their separation, relative sizes, glow and orbit are compressed illustrations, not measurements or a barycentric ephemeris.',
      observation: 'Explore the quieter blue-white photosphere, then open the shared view or visit Sirius B. Surface layers, visible colours and activity are procedural illustrations.',
      nextReason: 'Compare the bright main star with its small, dense stellar remnant.'
    },
    zh: {
      name: '天狼星', type: '地球夜空中最亮的恒星', fact: '距地球约 8.6 光年',
      invitation: '靠近地球夜空里，那颗格外明亮的星。',
      story: '天狼星是邻近的双星系统。这里可分别拜访蓝白主星与小得多的白矮星伴星。间距、相对尺寸、亮度和公转均经过艺术化压缩，不是测量比例或质心星历。',
      observation: '靠近较平缓的蓝白光球，再展开共同视角，或拜访天狼星 B。表面层次、可见色彩与活动为程序示意。',
      nextReason: '对照明亮的主星与小而致密的恒星残骸。'
    }
  },
  {
    key: 'betelgeuse', target: 'Betelgeuse', spaceRegion: 'milky-way', nextTarget: 'Orion Nebula', color: '#f18b5b', sourceLabel: 'NASA',
    sourceUrl: 'https://science.nasa.gov/universe/what-is-betelgeuse-inside-the-strange-volatile-star/',
    en: {
      name: 'Betelgeuse', type: 'Red supergiant', fact: 'On Orion’s shoulder',
      invitation: 'Encounter a swollen giant in a late stage of stellar life.',
      story: 'This orange-red supergiant marks Orion’s shoulder. Its expanding outer layers reveal a very different stage of stellar life from our Sun.',
      observation: 'Follow broad bright upwellings and cooler regions toward their finer edges and the softly extended outer envelope. Local outward plumes are artistic, not a replay of a measured eruption. Continue to a stellar nursery.',
      nextReason: 'From a late-life giant to a stellar nursery in the same constellation.'
    },
    zh: {
      name: '参宿四', type: '红超巨星', fact: '位于猎户座的肩部',
      invitation: '遇见一颗走到生命晚期、膨胀的巨星。',
      story: '这颗橙红色超巨星标记着猎户座的肩部。它膨胀的外层，展现了与太阳不同的恒星生命阶段。',
      observation: '从宽阔亮区与较冷区域靠近细密边缘，观察柔和外层与局部向外扩散。对流和逸出物为艺术示意，不是实测喷发的重放。随后去新恒星诞生的云中。',
      nextReason: '从生命晚期的巨星，前往同一星座中育星的云。'
    }
  }
];

// Search and category browsing can lead beyond the small starting selection.
const FRONTIER_NOTES = [
  {
    "key": "eris",
    "target": "Eris",
    "aliases": [
      "阋神星"
    ],
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Pluto",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/dwarf-planets/eris/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Eris",
      "type": "Dwarf planet",
      "fact": "An icy dwarf planet beyond Neptune",
      "spaceReference": "Within the Solar System",
      "invitation": "Look across pale frost regions, then compare with Pluto.",
      "story": "Eris belongs to the distant population of icy worlds beyond Neptune. The surface and shape, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Look across pale frost regions, then compare with Pluto.",
      "nextReason": "Compare its structure with Pluto."
    },
    "zh": {
      "name": "阋神星",
      "type": "矮行星",
      "fact": "海王星之外的冰质矮行星",
      "spaceReference": "太阳系内",
      "invitation": "观察淡色霜区，再与冥王星比较。",
      "story": "阋神星属于海王星之外的遥远冰世界。 这里的地貌、形状、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "观察淡色霜区，再与冥王星比较。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "haumea",
    "target": "Haumea",
    "aliases": [
      "妊神星"
    ],
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Eris",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/dwarf-planets/haumea/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Haumea",
      "type": "Dwarf planet",
      "fact": "A rapidly rotating elongated world",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the long silhouette and inspect its frost shading.",
      "story": "Haumea is a Kuiper Belt dwarf planet whose rapid rotation distorts its shape. Very little is known about its surface. The surface and shape, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Orbit the long silhouette and inspect its frost shading.",
      "nextReason": "Compare its structure with Eris."
    },
    "zh": {
      "name": "妊神星",
      "type": "矮行星",
      "fact": "快速自转的拉长世界",
      "spaceReference": "太阳系内",
      "invitation": "环视拉长的轮廓，近观霜层受光。",
      "story": "妊神星是柯伊伯带矮行星，快速自转使其形状拉长；表面细节仍知之甚少。 这里的地貌、形状、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "环视拉长的轮廓，近观霜层受光。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "makemake",
    "target": "Makemake",
    "aliases": [
      "鸟神星"
    ],
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Haumea",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/dwarf-planets/makemake/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Makemake",
      "type": "Dwarf planet",
      "fact": "A reddish world with frozen methane",
      "spaceReference": "Within the Solar System",
      "invitation": "Compare warm-toned patches with the paler elongated Haumea.",
      "story": "Makemake lies in the Kuiper Belt. Its surface appears reddish brown and spectroscopy reveals frozen methane and ethane. The surface and shape, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Compare warm-toned patches with the paler elongated Haumea.",
      "nextReason": "Compare its structure with Haumea."
    },
    "zh": {
      "name": "鸟神星",
      "type": "矮行星",
      "fact": "带有冰冻甲烷的红褐世界",
      "spaceReference": "太阳系内",
      "invitation": "比较暖色斑区与更淡的拉长妊神星。",
      "story": "鸟神星位于柯伊伯带，表面呈红褐色；光谱显示冰冻甲烷与乙烷。 这里的地貌、形状、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "比较暖色斑区与更淡的拉长妊神星。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "rhea",
    "target": "Rhea",
    "aliases": [
      "土卫五"
    ],
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Dione",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/rhea/",
    "mapSourceLabel": "NASA/JPL-Caltech/SSI/LPI · Cassini 2014 enhanced colour · resized",
    "en": {
      "name": "Rhea",
      "type": "Moon",
      "fact": "An old, heavily cratered ice world",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow crater rims from the whole sphere into close light and shadow.",
      "story": "Rhea is an icy moon of Saturn with a heavily cratered surface. The surface map is a resized Cassini 2014 global mosaic, credited to NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute. Enhanced ultraviolet and infrared colours are not natural colour; original lighting, seams and unequal detail remain. The solid shape is artistic and is not registered to the map as measured terrain. Albedo-derived fine shading, orientation, rotation, position and compressed scale are illustrations, not current observations or measured elevation.",
      "observation": "Follow crater rims from the whole sphere into close light and shadow.",
      "nextReason": "Compare its structure with Dione."
    },
    "zh": {
      "name": "土卫五",
      "type": "卫星",
      "fact": "古老而密布撞击坑的冰世界",
      "spaceReference": "太阳系内",
      "invitation": "从完整球面接近坑缘，观察亮暗层次。",
      "story": "土卫五是土星的冰质卫星，表面密布古老撞击坑。表面使用缩小后的卡西尼 2014 年全球镶嵌图，归属 NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute。增强的紫外与红外色彩不是自然色；保留原图受光、拼接痕迹与精度差异。立体形体为艺术示意，未与底图配准为实测地形；底图亮度衍生的细微受光、朝向、旋转、位置与压缩尺度均属示意，不是当前观测或实测高程。",
      "observation": "从完整球面接近坑缘，观察亮暗层次。",
      "nextReason": "把密集撞击坑与土卫四的亮色裂崖比较。"
    },
    "mapSourceUrl": "https://www.jpl.nasa.gov/images/pia18438-color-maps-of-rhea-2014/"
  },
  {
    "key": "dione",
    "target": "Dione",
    "aliases": [
      "土卫四"
    ],
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Tethys",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/dione/",
    "mapSourceLabel": "NASA/JPL-Caltech/SSI/LPI · Cassini 2014 enhanced colour · resized",
    "en": {
      "name": "Dione",
      "type": "Moon",
      "fact": "Bright ice walls cross the plains",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow the branching bright fractures, orbit into the darker hemisphere, then compare Tethys.",
      "story": "Cassini revealed that Dione’s bright wisps are fractured canyon ice walls. The surface map is a resized Cassini 2014 global mosaic, credited to NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute. Enhanced ultraviolet and infrared colours are not natural colour; original lighting, seams and unequal detail remain. The solid shape is artistic and is not registered to the map as measured terrain. Albedo-derived fine shading, orientation, rotation, position and compressed scale are illustrations, not current observations or measured elevation.",
      "observation": "Follow the branching bright fractures, orbit into the darker hemisphere, then compare Tethys.",
      "nextReason": "Compare its structure with Tethys."
    },
    "zh": {
      "name": "土卫四",
      "type": "卫星",
      "fact": "亮色冰壁穿过平原",
      "spaceReference": "太阳系内",
      "invitation": "沿分叉的亮色裂纹接近，环视暗色半球，再与土卫三比较。",
      "story": "卡西尼发现土卫四的亮色细纹是断裂的峡谷冰壁。表面使用缩小后的卡西尼 2014 年全球镶嵌图，归属 NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute。增强的紫外与红外色彩不是自然色；保留原图受光、拼接痕迹与精度差异。立体形体为艺术示意，未与底图配准为实测地形；底图亮度衍生的细微受光、朝向、旋转、位置与压缩尺度均属示意，不是当前观测或实测高程。",
      "observation": "沿分叉的亮色裂纹接近，环视暗色半球，再与土卫三比较。",
      "nextReason": "比较裂崖与土卫三宽阔盆地的不同地貌。"
    },
    "mapSourceUrl": "https://www.jpl.nasa.gov/images/pia18434-color-maps-of-dione-2014/"
  },
  {
    "key": "tethys",
    "target": "Tethys",
    "aliases": [
      "土卫三"
    ],
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Rhea",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/tethys/",
    "mapSourceLabel": "NASA/JPL-Caltech/SSI/LPI · Cassini 2014 enhanced colour · resized",
    "en": {
      "name": "Tethys",
      "type": "Moon",
      "fact": "An icy moon with a giant impact basin",
      "spaceReference": "Within the Solar System",
      "invitation": "Inspect the broad basin and withdraw to the Saturn family.",
      "story": "Tethys has the large Odysseus impact crater and the long Ithaca Chasma valley. The surface map is a resized Cassini 2014 global mosaic, credited to NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute. Enhanced ultraviolet and infrared colours are not natural colour; original lighting, seams and unequal detail remain. The solid shape is artistic and is not registered to the map as measured terrain. Albedo-derived fine shading, orientation, rotation, position and compressed scale are illustrations, not current observations or measured elevation.",
      "observation": "Inspect the broad basin and withdraw to the Saturn family.",
      "nextReason": "Compare its structure with Rhea."
    },
    "zh": {
      "name": "土卫三",
      "type": "卫星",
      "fact": "带有巨大撞击盆地的冰卫星",
      "spaceReference": "太阳系内",
      "invitation": "近观宽阔盆地，再退回土星家族。",
      "story": "土卫三拥有巨大的奥德修斯撞击坑与漫长的伊萨卡峡谷。表面使用缩小后的卡西尼 2014 年全球镶嵌图，归属 NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute。增强的紫外与红外色彩不是自然色；保留原图受光、拼接痕迹与精度差异。立体形体为艺术示意，未与底图配准为实测地形；底图亮度衍生的细微受光、朝向、旋转、位置与压缩尺度均属示意，不是当前观测或实测高程。",
      "observation": "近观宽阔盆地，再退回土星家族。",
      "nextReason": "回到土卫五，比较同一家族的撞击地貌。"
    },
    "mapSourceUrl": "https://www.jpl.nasa.gov/images/pia18439-color-maps-of-tethys-2014/"
  },
  {
    "key": "proteus",
    "target": "Proteus",
    "aliases": [
      "海卫八"
    ],
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Triton",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/neptune/moons/proteus/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Proteus",
      "type": "Moon",
      "fact": "A dark irregular companion of Neptune",
      "spaceReference": "Within the Solar System",
      "invitation": "Turn the dark rocky silhouette against Neptune and the star field.",
      "story": "Voyager 2 discovered Proteus. It is dark, irregularly shaped and heavily cratered. The surface and shape, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Turn the dark rocky silhouette against Neptune and the star field.",
      "nextReason": "Compare its structure with Triton."
    },
    "zh": {
      "name": "海卫八",
      "type": "卫星",
      "fact": "海王星的暗色不规则伴星",
      "spaceReference": "太阳系内",
      "invitation": "环视暗色岩体，以海王星与星空辨认方向。",
      "story": "旅行者2号发现海卫八；它颜色很暗、形状不规则，并有许多撞击坑。 这里的地貌、形状、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "环视暗色岩体，以海王星与星空辨认方向。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "eros",
    "shapeSourceLabel": "NASA VTAD · simplified 3D visualization",
    "shapeSourceUrl": "https://science.nasa.gov/resource/eros-3d-model/",
    "target": "Eros",
    "aliases": [
      "爱神星",
      "433 Eros"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Bennu",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/solar-system/asteroids/433-eros/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Eros",
      "type": "Asteroid",
      "fact": "The first asteroid orbited and landed on",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the long, uneven shoulders; approach crater rims and the curved ridge.",
      "story": "NEAR Shoemaker orbited Eros and landed on it in 2001. Its concave solid is derived from NASA’s finite 3D visualization model, uniformly fitted inside the display proportions. Fine surface relief and colours are procedural illustrations; orientation, rotation, orbit and compressed scale are artistic, not measured geography or a live ephemeris.",
      "observation": "Orbit the long, uneven shoulders; approach crater rims and the curved ridge.",
      "nextReason": "Compare its structure with Bennu."
    },
    "zh": {
      "name": "爱神星",
      "type": "小行星",
      "fact": "首个被航天器环绕并着陆的小行星",
      "spaceReference": "太阳系内",
      "invitation": "环视拉长而不平整的肩部，接近受光坑缘与弯曲脊线。",
      "story": "NEAR Shoemaker 环绕爱神星，并于2001年着陆；航天器观测到撞击坑与长山脊。 凹凸实体来自 NASA 有限三维可视化模型，统一缩放至显示比例内。细小起伏和颜色为程序示意；朝向、自转、轨道和压缩尺度均为艺术表达，并非实测地理或实时星历。",
      "observation": "环视拉长而不平整的肩部，接近受光坑缘与弯曲脊线。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "bennu",
    "shapeSourceLabel": "NASA VTAD · simplified 3D visualization",
    "shapeSourceUrl": "https://science.nasa.gov/resource/bennu-3d-model/",
    "target": "Bennu",
    "aliases": [
      "贝努",
      "101955 Bennu"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Eros",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/solar-system/asteroids/101955-bennu/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Bennu",
      "type": "Asteroid",
      "fact": "A rubble world sampled by OSIRIS-REx",
      "spaceReference": "Within the Solar System",
      "invitation": "Approach angular charcoal stones and the broad equatorial shoulder; orbit, pause and compare with Eros.",
      "story": "Bennu formed from leftover rubble. OSIRIS-REx observed many boulders, collected a sample in 2020 and returned it to Earth in 2023. The equatorial shoulder and irregular solid are derived from NASA’s finite 3D visualization model, not the mission’s centimetre-resolution terrain product. Charcoal colours, fine rubble, lighting, orientation, rotation and compressed scale are artistic illustrations.",
      "observation": "Approach angular charcoal stones and the broad equatorial shoulder; orbit, pause and compare with Eros.",
      "nextReason": "Compare its structure with Eros."
    },
    "zh": {
      "name": "贝努",
      "type": "小行星",
      "fact": "OSIRIS-REx 采样的碎石世界",
      "spaceReference": "太阳系内",
      "invitation": "接近炭灰石块与宽阔赤道肩部，环视、暂停，再与爱神星比较。",
      "story": "贝努由残余碎石聚集而成；OSIRIS-REx 观测到大量巨石，于2020年采样并在2023年送回地球。 赤道肩部与不规则实体来自 NASA 有限三维可视化模型，并非任务的厘米级地形产品。炭灰色、细碎石、受光、朝向、自转和压缩尺度均为艺术示意。",
      "observation": "接近炭灰石块与宽阔赤道肩部，环视、暂停，再与爱神星比较。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "wild-2",
    "target": "Wild 2",
    "aliases": [
      "维尔特2号",
      "81P/Wild"
    ],
    "bodyKind": "comet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Tempel 1",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/solar-system/comets/81p-wild/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Wild 2",
      "type": "Comet",
      "fact": "A comet sampled by Stardust",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow the twin tails to the compact nucleus and its active sites.",
      "story": "Stardust flew by the flattened nucleus of Wild 2 in 2004, collected particles and returned them to Earth in 2006. The surface and shape, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Follow the twin tails to the compact nucleus and its active sites.",
      "nextReason": "Compare its structure with Tempel 1."
    },
    "zh": {
      "name": "维尔特2号",
      "type": "彗星",
      "fact": "星尘号采集物质的彗星",
      "spaceReference": "太阳系内",
      "invitation": "沿双尾接近紧凑彗核与活动点。",
      "story": "星尘号于2004年飞掠维尔特2号的扁形彗核，采集颗粒并在2006年送回地球。 这里的地貌、形状、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "沿双尾接近紧凑彗核与活动点。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "tempel-1",
    "target": "Tempel 1",
    "aliases": [
      "坦普尔1号",
      "9P/Tempel 1"
    ],
    "bodyKind": "comet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Wild 2",
    "color": "#9eafc5",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/solar-system/comets/9p-tempel-1/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Tempel 1",
      "type": "Comet",
      "fact": "A nucleus visited by Deep Impact",
      "spaceReference": "Within the Solar System",
      "invitation": "Compare the broad nucleus, recessed floors and jets with Wild 2.",
      "story": "Deep Impact released an impactor into Tempel 1 in 2005. Stardust NExT revisited it in 2011. The surface and shape, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Compare the broad nucleus, recessed floors and jets with Wild 2.",
      "nextReason": "Compare its structure with Wild 2."
    },
    "zh": {
      "name": "坦普尔1号",
      "type": "彗星",
      "fact": "深度撞击号拜访的彗核",
      "spaceReference": "太阳系内",
      "invitation": "比较宽阔彗核、凹陷坑底与喷流。",
      "story": "深度撞击号于2005年向坦普尔1号释放撞击器；Stardust NExT 于2011年再次拜访。 这里的地貌、形状、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "比较宽阔彗核、凹陷坑底与喷流。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "eagle-nebula",
    "target": "Eagle Nebula",
    "aliases": [
      "鹰状星云",
      "M16",
      "IC4703"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Horsehead Nebula",
    "color": "#9eafc5",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-16/",
    "mapSourceLabel": null,
    "en": {
      "name": "Eagle Nebula",
      "type": "Nebula",
      "fact": "Star-forming towers of gas and dust",
      "spaceReference": "Within the Milky Way",
      "invitation": "Approach three dust towers and orbit their illuminated rims.",
      "story": "The Eagle Nebula contains the Pillars of Creation. Young stars heat and erode the surrounding gas and dust. The gas and dust, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Approach three dust towers and orbit their illuminated rims.",
      "nextReason": "Compare its structure with Horsehead Nebula."
    },
    "zh": {
      "name": "鹰状星云",
      "type": "星云",
      "fact": "孕育恒星的气体与暗尘柱",
      "spaceReference": "银河系内",
      "invitation": "接近三座暗尘柱，环视受照边缘。",
      "story": "鹰状星云包含创生之柱；年轻恒星加热并侵蚀周围的气体与暗尘。 这里的气体、暗尘和细丝、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "接近三座暗尘柱，环视受照边缘。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "horsehead-nebula",
    "target": "Horsehead Nebula",
    "aliases": [
      "马头星云",
      "B33",
      "Barnard 33"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Eagle Nebula",
    "color": "#9eafc5",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/asset/hubble/the-horsehead-nebula/",
    "mapSourceLabel": null,
    "en": {
      "name": "Horsehead Nebula",
      "type": "Nebula",
      "fact": "A dark cloud outlined by glowing gas",
      "spaceReference": "Within the Milky Way",
      "invitation": "Approach the dark neck against the red curtain, then orbit behind it.",
      "story": "The Horsehead is a dense cloud of gas and dust in Orion. Its silhouette depends on the light and wavelength used to observe it. The gas and dust, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Approach the dark neck against the red curtain, then orbit behind it.",
      "nextReason": "Compare its structure with Eagle Nebula."
    },
    "zh": {
      "name": "马头星云",
      "type": "星云",
      "fact": "被发光气体勾勒的暗云",
      "spaceReference": "银河系内",
      "invitation": "接近红色云幕前的暗色颈部，再环视它的背面。",
      "story": "马头星云是猎户座方向的致密气体与暗尘云；轮廓随光照与观测波段而变化。 这里的气体、暗尘和细丝、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "接近红色云幕前的暗色颈部，再环视它的背面。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "carina-nebula",
    "target": "Carina Nebula",
    "aliases": [
      "船底座星云",
      "NGC3372"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Lagoon Nebula",
    "color": "#9eafc5",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/missions/hubble/the-carina-nebula-star-birth-in-the-extreme/",
    "mapSourceLabel": null,
    "en": {
      "name": "Carina Nebula",
      "type": "Nebula",
      "fact": "Stellar winds carve cloud cliffs",
      "spaceReference": "Within the Milky Way",
      "invitation": "Follow the warm cliff edge around a blue cavity, then recover the whole cloud.",
      "story": "Hubble reveals eroded dust pillars and star-forming clouds in Carina. Stellar winds and radiation sculpt the gas. The gas and dust, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Follow the warm cliff edge around a blue cavity, then recover the whole cloud.",
      "nextReason": "Compare its structure with Lagoon Nebula."
    },
    "zh": {
      "name": "船底座星云",
      "type": "星云",
      "fact": "恒星风雕刻云崖",
      "spaceReference": "银河系内",
      "invitation": "沿暖色云崖观察蓝色空腔，再退离恢复整片云。",
      "story": "哈勃揭示船底座中的受侵蚀暗尘柱与恒星诞生云；恒星风与辐射雕刻气体。 这里的气体、暗尘和细丝、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "沿暖色云崖观察蓝色空腔，再退离恢复整片云。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  },
  {
    "key": "crab-nebula",
    "target": "Crab Nebula",
    "aliases": [
      "蟹状星云",
      "M1",
      "NGC1952"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Crab Pulsar",
    "color": "#9eafc5",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/asset/hubble/crab-nebula-3/",
    "mapSourceLabel": null,
    "en": {
      "name": "Crab Nebula",
      "type": "Nebula",
      "fact": "Filaments around a supernova remnant",
      "spaceReference": "Within the Milky Way",
      "invitation": "Enter the porous filament shell, then visit the pulsar at its centre.",
      "story": "The Crab Nebula is a supernova remnant. Orange gas filaments surround a blue interior powered by its central pulsar. The gas and dust, colours, activity, position and compressed scale shown here are procedural artistic illustrations, not measured geography or a spacecraft/telescope reconstruction.",
      "observation": "Enter the porous filament shell, then visit the pulsar at its centre.",
      "nextReason": "Compare its structure with Crab Pulsar."
    },
    "zh": {
      "name": "蟹状星云",
      "type": "星云",
      "fact": "超新星残骸周围的气体丝网",
      "spaceReference": "银河系内",
      "invitation": "进入疏松丝网壳层，再拜访中央脉冲星。",
      "story": "蟹状星云是超新星残骸；橙色气体细丝围绕由中央脉冲星驱动的蓝色内部。 这里的气体、暗尘和细丝、颜色、活动、位置与压缩尺度均为程序生成的艺术示意，不是实测地理或航天器/望远镜重建。",
      "observation": "进入疏松丝网壳层，再拜访中央脉冲星。",
      "nextReason": "继续比较另一种天体的结构。"
    }
  }
];

DESTINATIONS.push(...FRONTIER_NOTES.filter(note=>['nebula','dwarfplanet','asteroid'].includes(note.bodyKind)));

const SMALL_WORLD_NOTES = [
  {
    "key": "ryugu",
    "target": "Ryugu",
    "aliases": [
      "162173 Ryugu",
      "龙宫"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Bennu",
    "color": "#c3b39b",
    "sourceLabel": "JAXA",
    "sourceUrl": "https://global.jaxa.jp/press/2022/06/20220610-1_e.html",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Ryugu",
      "type": "Asteroid",
      "fact": "A spinning-top asteroid sampled by Hayabusa2",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow the pointed shoulders into the equatorial ridge and charcoal rubble; compare with Bennu.",
      "story": "Ryugu is a carbon-rich asteroid. Hayabusa2 returned samples to Earth; JAXA describes its characteristic spinning-top form. The shape, surface, colours, spin, orbit, activity, placement and compressed sizes are procedural artistic illustrations, not a spacecraft mesh, measured geography or live ephemeris.",
      "observation": "Follow the pointed shoulders into the equatorial ridge and charcoal rubble; compare with Bennu.",
      "nextReason": "Compare its structure with Bennu."
    },
    "zh": {
      "name": "龙宫",
      "type": "小行星",
      "fact": "隼鸟2号采样的陀螺形小行星",
      "spaceReference": "太阳系内",
      "invitation": "沿收尖的肩部接近赤道脊和炭灰碎石，再与贝努对照。",
      "story": "龙宫是一颗富碳小行星，隼鸟2号已将样品送回地球；JAXA 资料描述了其典型陀螺形外观。 这里的形状、表面、颜色、自转、轨道、活动、位置和压缩尺寸均为程序艺术示意，不是航天器网格、实测地理或实时星历。",
      "observation": "沿收尖的肩部接近赤道脊和炭灰碎石，再与贝努对照。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  },
  {
    "key": "itokawa",
    "shapeSourceLabel": "Robert Gaskell / ISAS/JAXA · Hayabusa shape · simplified",
    "shapeSourceUrl": "https://darts.isas.jaxa.jp/en/datasets/darts%3Ahayabusa-itokawa-shape-model-gaskell",
    "target": "Itokawa",
    "aliases": [
      "25143 Itokawa",
      "丝川"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "67P/Churyumov-Gerasimenko",
    "color": "#c3b39b",
    "sourceLabel": "JAXA",
    "sourceUrl": "https://global.jaxa.jp/article/special/hayabusa_sp3/index_e.html",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Itokawa",
      "type": "Asteroid",
      "fact": "Two joined lobes, rough rocks and smoother patches",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the unequal lobes and concave waist, approach warm angular stones, then compare with the two-lobed comet 67P.",
      "story": "Hayabusa images reveal Itokawa’s unusual form, abundant rocks and distinct surface areas; the mission returned asteroid samples in 2010. Its unequal lobes, concave waist and broad relief are derived from the Gaskell Hayabusa shape model, credited Robert Gaskell and ISAS/JAXA. The mesh is simplified and uniformly fitted to the display envelope. Warm colours, fine gravel, lighting, orientation, spin and orbit are illustrative, not the source model’s original resolution or measured reflectance.",
      "observation": "Orbit the unequal lobes and concave waist, approach warm angular stones, then compare with the two-lobed comet 67P.",
      "nextReason": "Compare its structure with 67P/Churyumov-Gerasimenko."
    },
    "zh": {
      "name": "丝川",
      "type": "小行星",
      "fact": "双叶连接、粗糙石块与较平滑区域",
      "spaceReference": "太阳系内",
      "invitation": "环视不等大的双叶与内凹腰部，接近暖色棱角石块，再对照双叶彗星67P。",
      "story": "隼鸟号图像展示了丝川不寻常的形状、大量石块和不同表面区域，任务于2010年带回小行星样品。 不等大的双叶、内凹腰部与宽阔起伏来自 Gaskell 隼鸟号形状模型，归属 Robert Gaskell 与 ISAS/JAXA。网格已简化并统一缩放至显示包络；暖色、细碎石、受光、朝向、自转和轨道属于示意，并非原模型分辨率或测量反射率。",
      "observation": "环视不等大的双叶与内凹腰部，接近暖色棱角石块，再对照双叶彗星67P。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  },
  {
    "key": "lutetia",
    "target": "Lutetia",
    "aliases": [
      "21 Lutetia",
      "卢泰西亚"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Mathilde",
    "color": "#c3b39b",
    "sourceLabel": "ESA",
    "sourceUrl": "https://www.esa.int/Science_Exploration/Space_Science/Rosetta/Rosetta_triumphs_at_asteroid_Lutetia",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Lutetia",
      "type": "Asteroid",
      "fact": "A rocky world visited by Rosetta in 2010",
      "spaceReference": "Within the Solar System",
      "invitation": "Approach the pale rocky shoulders, broad bowls and curved fractures, then compare with darker Mathilde.",
      "story": "Rosetta flew past Lutetia on 10 July 2010, returning close views of its irregular rocky form. The shape, surface, colours, spin, orbit, activity, placement and compressed sizes are procedural artistic illustrations, not a spacecraft mesh, measured geography or live ephemeris.",
      "observation": "Approach the pale rocky shoulders, broad bowls and curved fractures, then compare with darker Mathilde.",
      "nextReason": "Compare its structure with Mathilde."
    },
    "zh": {
      "name": "卢泰西亚",
      "type": "小行星",
      "fact": "罗塞塔号于2010年飞掠的岩石世界",
      "spaceReference": "太阳系内",
      "invitation": "接近浅色岩石肩部、宽阔坑碗和弯曲裂痕，再与更暗的玛蒂尔德对照。",
      "story": "罗塞塔号于2010年7月10日飞掠卢泰西亚，带回其不规则岩石外形的近距离影像。 这里的形状、表面、颜色、自转、轨道、活动、位置和压缩尺寸均为程序艺术示意，不是航天器网格、实测地理或实时星历。",
      "observation": "接近浅色岩石肩部、宽阔坑碗和弯曲裂痕，再与更暗的玛蒂尔德对照。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  },
  {
    "key": "ida",
    "target": "Ida",
    "aliases": [
      "243 Ida",
      "艾达"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Dactyl",
    "color": "#c3b39b",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/solar-system/asteroids/243-ida/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Ida",
      "type": "Asteroid",
      "fact": "The first asteroid found to have a moon",
      "spaceReference": "Within the Solar System",
      "invitation": "Observe the long cratered body, open its family to visit Dactyl, and return to see their relationship.",
      "story": "Galileo flew past Ida in 1993. Its images led to the discovery of Dactyl, the first known asteroid moon. The shape, surface, colours, spin, orbit, activity, placement and compressed sizes are procedural artistic illustrations, not a spacecraft mesh, measured geography or live ephemeris.",
      "observation": "Observe the long cratered body, open its family to visit Dactyl, and return to see their relationship.",
      "nextReason": "Compare its structure with Dactyl."
    },
    "zh": {
      "name": "艾达",
      "type": "小行星",
      "fact": "第一颗被发现拥有卫星的小行星",
      "spaceReference": "太阳系内",
      "invitation": "观察狭长多坑的主体，打开家族前往达克蒂尔，再返回理解两者的关系。",
      "story": "伽利略号于1993年飞掠艾达，其图像促成了达克蒂尔的发现，这是首颗已知小行星卫星。 这里的形状、表面、颜色、自转、轨道、活动、位置和压缩尺寸均为程序艺术示意，不是航天器网格、实测地理或实时星历。",
      "observation": "观察狭长多坑的主体，打开家族前往达克蒂尔，再返回理解两者的关系。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  },
  {
    "key": "dactyl",
    "target": "Dactyl",
    "aliases": [
      "达克蒂尔"
    ],
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Ida",
    "color": "#c3b39b",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/solar-system/asteroids/243-ida/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Dactyl",
      "type": "Moon",
      "fact": "Ida’s small companion discovered in Galileo images",
      "spaceReference": "Near Ida in the Solar System",
      "invitation": "Inspect a small rounded, cratered companion; use the parent or family controls to return to Ida.",
      "story": "Dactyl was discovered in Galileo imaging data in 1994 and is a moon of asteroid Ida. The shape, surface, colours, spin, orbit, activity, placement and compressed sizes are procedural artistic illustrations, not a spacecraft mesh, measured geography or live ephemeris.",
      "observation": "Inspect a small rounded, cratered companion; use the parent or family controls to return to Ida.",
      "nextReason": "Compare its structure with Ida."
    },
    "zh": {
      "name": "达克蒂尔",
      "type": "卫星",
      "fact": "从伽利略号图像中发现的艾达小伴星",
      "spaceReference": "太阳系内 · 艾达附近",
      "invitation": "查看小型圆钝、多坑的伴星，用母天体或家族入口返回艾达。",
      "story": "达克蒂尔于1994年从伽利略号影像资料中被发现，是小行星艾达的卫星。 这里的形状、表面、颜色、自转、轨道、活动、位置和压缩尺寸均为程序艺术示意，不是航天器网格、实测地理或实时星历。",
      "observation": "查看小型圆钝、多坑的伴星，用母天体或家族入口返回艾达。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  },
  {
    "key": "mathilde",
    "target": "Mathilde",
    "aliases": [
      "253 Mathilde",
      "玛蒂尔德"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Lutetia",
    "color": "#c3b39b",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/solar-system/asteroids/253-mathilde/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Mathilde",
      "type": "Asteroid",
      "fact": "A dark world dominated by huge craters",
      "spaceReference": "Within the Solar System",
      "invitation": "Approach broad dark crater bowls and raised rims; retreat to compare their scale with the body.",
      "story": "NEAR flew past Mathilde on 27 June 1997. Its images show an irregular world with exceptionally large impact craters. The shape, surface, colours, spin, orbit, activity, placement and compressed sizes are procedural artistic illustrations, not a spacecraft mesh, measured geography or live ephemeris.",
      "observation": "Approach broad dark crater bowls and raised rims; retreat to compare their scale with the body.",
      "nextReason": "Compare its structure with Lutetia."
    },
    "zh": {
      "name": "玛蒂尔德",
      "type": "小行星",
      "fact": "遍布巨大撞击坑的暗色世界",
      "spaceReference": "太阳系内",
      "invitation": "接近宽大的暗色坑碗和隆起坑缘，退远观察坑与主体的尺度关系。",
      "story": "NEAR 于1997年6月27日飞掠玛蒂尔德，图像展示了其不规则外形及异常巨大的撞击坑。 这里的形状、表面、颜色、自转、轨道、活动、位置和压缩尺寸均为程序艺术示意，不是航天器网格、实测地理或实时星历。",
      "observation": "接近宽大的暗色坑碗和隆起坑缘，退远观察坑与主体的尺度关系。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  },
  {
    "key": "psyche",
    "target": "Psyche",
    "aliases": [
      "16 Psyche",
      "灵神星"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Eros",
    "color": "#c3b39b",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/solar-system/asteroids/16-psyche/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Psyche",
      "type": "Asteroid",
      "fact": "A rock-and-metal world whose surface remains unknown",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit subdued stone and metal glints, read the uncertainty, then compare with Eros.",
      "story": "Radar and thermal observations suggest Psyche is a mixture of rock and metal. NASA states that its actual close-up appearance is still unknown. The restrained rough metallic glints here are an artistic hypothesis. The shape, surface, colours, spin, orbit, activity, placement and compressed sizes are procedural artistic illustrations, not a spacecraft mesh, measured geography or live ephemeris.",
      "observation": "Orbit subdued stone and metal glints, read the uncertainty, then compare with Eros.",
      "nextReason": "Compare its structure with Eros."
    },
    "zh": {
      "name": "灵神星",
      "type": "小行星",
      "fact": "表面尚不明确的岩石与金属世界",
      "spaceReference": "太阳系内",
      "invitation": "环视克制的岩石与金属微光，阅读不确定性说明，再与爱神星对照。",
      "story": "雷达与热观测提示灵神星由岩石和金属混合组成。NASA 说明其真实近景外观仍不明确；此处克制的粗糙金属反光是艺术化假设。 这里的形状、表面、颜色、自转、轨道、活动、位置和压缩尺寸均为程序艺术示意，不是航天器网格、实测地理或实时星历。",
      "observation": "环视克制的岩石与金属微光，阅读不确定性说明，再与爱神星对照。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  },
  {
    "key": "gaspra",
    "target": "Gaspra",
    "aliases": [
      "951 Gaspra",
      "加斯普拉"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Ida",
    "color": "#c3b39b",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/resource/ida-and-gaspra/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Gaspra",
      "type": "Asteroid",
      "fact": "An angular asteroid imaged by Galileo",
      "spaceReference": "Within the Solar System",
      "invitation": "Observe rust-coloured angular shoulders, small pits and a long fracture; compare with Ida.",
      "story": "Galileo photographed Gaspra before visiting Ida, giving close views of an angular, cratered asteroid. The shape, surface, colours, spin, orbit, activity, placement and compressed sizes are procedural artistic illustrations, not a spacecraft mesh, measured geography or live ephemeris.",
      "observation": "Observe rust-coloured angular shoulders, small pits and a long fracture; compare with Ida.",
      "nextReason": "Compare its structure with Ida."
    },
    "zh": {
      "name": "加斯普拉",
      "type": "小行星",
      "fact": "由伽利略号拍摄的棱角小行星",
      "spaceReference": "太阳系内",
      "invitation": "观察锈色棱角肩部、细坑和长裂痕，再对照艾达。",
      "story": "伽利略号在到访艾达之前拍摄了加斯普拉，带回了这颗棱角分明、多坑小行星的近景。 这里的形状、表面、颜色、自转、轨道、活动、位置和压缩尺寸均为程序艺术示意，不是航天器网格、实测地理或实时星历。",
      "observation": "观察锈色棱角肩部、细坑和长裂痕，再对照艾达。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  },
  {
    "key": "steins",
    "target": "Steins",
    "aliases": [
      "2867 Steins",
      "Šteins",
      "斯坦斯"
    ],
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Lutetia",
    "color": "#c3b39b",
    "sourceLabel": "ESA",
    "sourceUrl": "https://www.esa.int/Science_Exploration/Space_Science/Rosetta/Steins_A_diamond_in_the_sky",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "Steins",
      "type": "Asteroid",
      "fact": "A diamond-shaped world visited by Rosetta",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the tapered lower half, approach the pale polar basin, then compare with Lutetia.",
      "story": "Rosetta flew past Steins on 5 September 2008, revealing a small diamond-shaped asteroid with impact craters. The shape, surface, colours, spin, orbit, activity, placement and compressed sizes are procedural artistic illustrations, not a spacecraft mesh, measured geography or live ephemeris.",
      "observation": "Orbit the tapered lower half, approach the pale polar basin, then compare with Lutetia.",
      "nextReason": "Compare its structure with Lutetia."
    },
    "zh": {
      "name": "斯坦斯",
      "type": "小行星",
      "fact": "罗塞塔号飞掠过的菱形世界",
      "spaceReference": "太阳系内",
      "invitation": "环视收尖的下半部，接近浅色极侧坑盆，再与卢泰西亚比较。",
      "story": "罗塞塔号于2008年9月5日飞掠斯坦斯，发现这颗布满撞击坑的小行星呈菱形。 这里的形状、表面、颜色、自转、轨道、活动、位置和压缩尺寸均为程序艺术示意，不是航天器网格、实测地理或实时星历。",
      "observation": "环视收尖的下半部，接近浅色极侧坑盆，再与卢泰西亚比较。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  },
  {
    "key": "67p",
    "shapeSourceLabel": "ESA/Rosetta/NAVCAM · SPC-ESA MTP019 · simplified · CC BY-SA 3.0 IGO",
    "shapeSourceUrl": "https://blogs.esa.int/rosetta/2015/11/30/new-comet-shape-model/",
    "target": "67P/Churyumov-Gerasimenko",
    "aliases": [
      "67P",
      "Churyumov-Gerasimenko",
      "丘留莫夫-格拉西缅科",
      "罗塞塔彗星"
    ],
    "bodyKind": "comet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Itokawa",
    "color": "#c3b39b",
    "sourceLabel": "ESA",
    "sourceUrl": "https://www.esa.int/ESA_Multimedia/Images/2016/07/Comet_cliffs",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "en": {
      "name": "67P / Rosetta’s comet",
      "type": "Comet",
      "fact": "Rosetta’s comet: two lobes, cliffs and a narrow neck",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow the tails toward the dark nucleus, orbit the hollow waist and layered ledges, and compare its form with Itokawa.",
      "story": "Rosetta observed two unequal lobes joined by a neck, with cliffs, smoother dusty patches and boulders. The solid is simplified from the archived ESA/RMOC NAVCAM SPC-ESA MTP019 model (NASA PDS / ESA PSA), credited ESA/Rosetta/NAVCAM under CC BY-SA 3.0 IGO. Scaling and orientation were changed for this scene. Colours, small layered relief, dust, jets and compressed tails are procedural illustrations, not measured vents or present activity.",
      "observation": "Follow the tails toward the dark nucleus, orbit the hollow waist and layered ledges, and compare its form with Itokawa.",
      "nextReason": "Compare its structure with Itokawa."
    },
    "zh": {
      "name": "67P 彗星",
      "type": "彗星",
      "fact": "罗塞塔号彗星：双叶、陡壁与狭颈",
      "spaceReference": "太阳系内",
      "invitation": "沿彗尾接近暗色彗核，环视内凹腰部与分层台阶，再和丝川对照。",
      "story": "罗塞塔号观测到不等大的双叶、连接狭颈，以及陡壁、较平滑积尘区和巨石。 实体由归档的 ESA/RMOC NAVCAM SPC-ESA MTP019 模型简化而成（NASA PDS / ESA PSA），归属 ESA/Rosetta/NAVCAM，许可 CC BY-SA 3.0 IGO；已为场景修改缩放与朝向。颜色、小层理受光、尘埃、喷流和压缩彗尾仍为程序示意，并非实测喷口或当前活动。",
      "observation": "沿彗尾接近暗色彗核，环视内凹腰部与分层台阶，再和丝川对照。",
      "nextReason": "继续对照其形状、表面或家族关系。"
    }
  }
];

// Unknown appearance remains explicit when a saved observation leaves the UI.
const psycheIllustration=SMALL_WORLD_NOTES.find(note=>note.key==='psyche');
psycheIllustration.en.representationNote='Psyche’s close-up surface is unknown; the rough metallic appearance is an artistic hypothesis.';
psycheIllustration.zh.representationNote='灵神星真实近景表面仍未知；粗糙金属外观是艺术化假设。';

const SOLAR_NOTES = [
  {
    "key": "mercury",
    "target": "Mercury",
    "bodyKind": "planet",
    "spaceRegion": "solar-system",
    "nextTarget": "Moon",
    "color": "#b7a68c",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/mercury/facts/",
    "mapSourceUrl": "https://www.solarsystemscope.com/textures/",
    "mapSourceLabel": "Solar System Scope / INOVE · CC BY 4.0",
    "en": {
      "name": "Mercury",
      "type": "Cratered rocky planet",
      "fact": "Closest planet to the Sun · An 88-day year",
      "invitation": "Follow sunlight across an ancient cratered world.",
      "story": "Mercury has ancient impact craters, smooth plains and long cliffs. The NASA-based map by Solar System Scope enhances colour and fills unmapped areas; it is resized here. Map-derived relief, lighting, spacing and motion are artistic, not measured elevation or a live observation.",
      "observation": "Approach from the whole globe to small crater rims. Orbit toward the day–night boundary to see relief in low light.",
      "nextReason": "Compare this small rocky world with the Moon’s mapped craters."
    },
    "zh": {
      "name": "水星",
      "type": "遍布陨石坑的岩石行星",
      "fact": "最靠近太阳的行星 · 公转约 88 天",
      "invitation": "沿着阳光，寻找古老世界上的撞击痕迹。",
      "story": "水星拥有古老撞击坑、平坦平原与长崖。底图由 Solar System Scope 基于 NASA 数据增强色彩、填补缺测区域，并在此缩小。底图衍生的起伏、光照、间距和动态为艺术化示意，不是测量高程或实时观测。",
      "observation": "从完整球面靠近较小坑缘，环视昼夜交界，在斜射光下辨认起伏。",
      "nextReason": "与月球有观测底图的陨石坑对照，观察两个小型岩石世界。"
    }
  },
  {
    "key": "venus",
    "target": "Venus",
    "bodyKind": "planet",
    "spaceRegion": "solar-system",
    "nextTarget": "Earth",
    "color": "#e5ce91",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/venus/venus-facts/",
    "observationSourceLabel": "NASA · Galileo ultraviolet observations",
    "observationSourceUrl": "https://science.nasa.gov/photojournal/venus-colorized-clouds/",
    "en": {
      "name": "Venus",
      "type": "Cloud-covered rocky planet",
      "fact": "Thick atmosphere · Second planet from the Sun",
      "invitation": "Enter the light above an opaque world of clouds.",
      "story": "Venus is a rocky planet hidden beneath thick clouds in a dense carbon dioxide atmosphere. Visible cloud streaks, wind, colour and spacing here are generated illustrations, not current weather or a view through to its surface.",
      "observation": "Follow broad cloud patterns, then move closer to subtle fine streaks. The cloud layer remains opaque.",
      "representationNote": "Cloud contrast and colour are enhanced illustrations, inspired by structures clearer in violet and ultraviolet light; this is not natural-colour imagery or a view of the ground.",
      "nextReason": "Compare opaque Venusian clouds with Earth’s clouds above oceans and continents."
    },
    "zh": {
      "name": "金星",
      "type": "厚云覆盖的岩石行星",
      "fact": "浓密大气 · 太阳的第二颗行星",
      "invitation": "接近云顶之光，观察被厚云遮住的世界。",
      "story": "金星是岩石行星，浓密二氧化碳大气中的厚云遮住地表。可见云纹、风、色彩与间距均为程序示意，并非当前天气，也不是透过云层观察地面。",
      "observation": "先辨认宽阔云纹，再靠近观察较细的条缕；厚云始终遮住下方地表。",
      "representationNote": "云纹与色彩为增强的艺术表达，参考紫光和紫外线中更清楚的结构；不是自然色图像或地表视图。",
      "nextReason": "与地球海洋、大陆上方的云系比较，观察不同的大气世界。"
    }
  },
  {
    "key": "uranus",
    "target": "Uranus",
    "bodyKind": "planet",
    "spaceRegion": "solar-system",
    "nextTarget": "Saturn",
    "color": "#91c9cd",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/uranus/facts/",
    "observationSourceLabel": "NASA · Hubble",
    "observationSourceUrl": "https://science.nasa.gov/asset/hubble/uranus-and-neptune/",
    "en": {
      "name": "Uranus",
      "type": "Tilted ice giant",
      "fact": "An almost sideways axis · Seventh planet from the Sun",
      "invitation": "Discover a pale world with rings turned on their side.",
      "story": "Uranus has a roughly 98-degree axial tilt and narrow, dark rings. Methane contributes to its blue-green appearance. Cloud bands, colour and a compressed selection of ring structure here are procedural illustrations, not measured weather or a complete ring reconstruction.",
      "observation": "Orbit to see the tilted rings pass in front of and behind the globe. Approach to find faint cloud bands and a brighter polar region.",
      "representationNote": "Cloud banks and the polar hood are authored, with enhanced colour and compressed scale; not a measured cloud map or current weather.",
      "nextReason": "Compare narrow, dark rings with Saturn’s broad bright ring system."
    },
    "zh": {
      "name": "天王星",
      "type": "倾斜的冰巨行星",
      "fact": "近乎躺倒的自转轴 · 太阳的第七颗行星",
      "invitation": "发现淡青色的世界与侧立的细环。",
      "story": "天王星的自转轴倾斜约 98 度，拥有狭窄、暗色的环。甲烷参与形成蓝绿色外观。云带、色彩与压缩选取的环结构为程序示意，不是实测天气或完整环系重建。",
      "observation": "环视细环与球体的前后遮挡，继续靠近寻找浅云带和较亮的极区。",
      "representationNote": "云岸与极地云帽为艺术创作，色彩增强、尺度压缩；不是测量云图或当前天气。",
      "nextReason": "与土星宽阔、明亮的环系比较，观察两种有环世界。"
    }
  },
  {
    "key": "neptune",
    "target": "Neptune",
    "bodyKind": "planet",
    "spaceRegion": "solar-system",
    "nextTarget": "Jupiter",
    "color": "#548cda",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/neptune/neptune-facts/",
    "observationSourceLabel": "NASA · Hubble",
    "observationSourceUrl": "https://science.nasa.gov/asset/hubble/uranus-and-neptune/",
    "en": {
      "name": "Neptune",
      "type": "Wind-swept ice giant",
      "fact": "Eighth planet from the Sun · No solid landing surface",
      "invitation": "Follow bright clouds across a distant blue world.",
      "story": "Neptune’s atmosphere has powerful winds, bright clouds and changing dark storms. This generated view accentuates their contrast. Its storm positions, fine cloud strands, colour, rotation and spacing are artistic, not current weather or a measured cloud map.",
      "observation": "Approach from broad belts to fine cloud streaks beside a dark storm. Orbit to see the cloud tops and day–night boundary.",
      "representationNote": "Storm locations, fine cloud banks, colour and cloud relief are authored illustrations, not measured altitudes, a natural-colour photograph or current weather.",
      "nextReason": "Compare an ice giant’s clouds and storms with Jupiter’s much larger gas giant atmosphere."
    },
    "zh": {
      "name": "海王星",
      "type": "强风中的冰巨行星",
      "fact": "太阳的第八颗行星 · 没有固体着陆表面",
      "invitation": "沿着亮云，探索遥远的蓝色世界。",
      "story": "海王星大气中有强风、亮云和不断变化的暗色风暴。程序画面增强了它们的对比；风暴位置、细云缕、色彩、转动和间距为艺术化表达，并非当前天气或测量云图。",
      "observation": "从宽阔云带靠近暗色风暴旁的细云缕，环视云顶与昼夜交界。",
      "representationNote": "风暴位置、细云岸、色彩与云层起伏为艺术示意，不是测量高度、自然色照片或当前天气。",
      "nextReason": "与木星更大的气态巨行星大气对照，观察两种云顶和风暴。"
    }
  }
];

const SATELLITE_NOTES = [
  {
    key: 'io', target: 'Io', bodyKind: 'moon', spaceRegion: 'solar-system',
    mapSourceLabel: 'NASA VTAD · visualization texture', mapSourceUrl: 'https://science.nasa.gov/resource/io-3d-model/',
    nextTarget: 'Europa', color: '#d7ab50', sourceLabel: 'NASA', sourceUrl: 'https://science.nasa.gov/jupiter/jupiter-moons/io/',
    en: {
      name: 'Io', type: 'Jupiter’s volcanic moon', fact: 'Volcanoes continually renew its surface',
      invitation: 'Find a world of sulphur plains and dark volcanic basins.',
      story: 'Jupiter’s gravity and the timed pulls of neighbouring moons heat Io through tidal flexing. Its many volcanoes renew the surface. The surface uses the attributed texture from NASA’s visualization model, resized for this scene. It is a historical visualization map, not current eruptions or measured elevation. Fine relief, lighting, scale and orbital motion are artistic.',
      observation: 'Approach the dark basins and reddish deposits, then orbit to see relief change in sunlight. Return to Jupiter through the parent-world control.',
      nextReason: 'Compare a volcanic world with its neighbour’s fractured ice shell.'
    },
    zh: {
      name: '木卫一', type: '木星的火山卫星', fact: '火山持续重塑地表',
      invitation: '寻找硫磺平原与暗色火山盆地。',
      story: '木星与邻近卫星的引力拉扯使木卫一发生潮汐形变并产生热量，众多火山持续更新地表。表面采用有归属、经过缩小的 NASA 可视化模型底图，呈现历史地貌，不是当前喷发或实测高程；细微地形增强、光照、比例与轨道动态为艺术化表现。',
      observation: '靠近暗色盆地与红褐色沉积，环视它们在阳光中的起伏；通过所属入口返回木星。',
      nextReason: '把火山世界与邻居的裂纹冰壳放在一起观察。'
    }
  },
  {
    key: 'europa', target: 'Europa', bodyKind: 'moon', spaceRegion: 'solar-system',
    mapSourceLabel: 'NASA VTAD · visualization texture', mapSourceUrl: 'https://science.nasa.gov/resource/europa-3d-model/',
    nextTarget: 'Enceladus', color: '#cfc5a6', sourceLabel: 'NASA', sourceUrl: 'https://science.nasa.gov/jupiter/jupiter-moons/europa/',
    en: {
      name: 'Europa', type: 'Jupiter’s icy moon', fact: 'Strong evidence for an ocean beneath the ice',
      invitation: 'Follow long fractures across a pale ice world.',
      story: 'Scientists find strong evidence for a saltwater ocean beneath Europa’s icy shell. Its surface has reddish brown lines and disrupted terrain. This scene uses the attributed texture from NASA’s visualization model, resized for display. Its mosaic is not measured elevation or a view through the ice; fine relief, lighting, position, scale and motion are artistic.',
      observation: 'Move closer to follow paired ridges and intersecting cracks. Orbit, then return to Jupiter or compare another icy moon.',
      nextReason: 'Visit a Saturn moon that releases water vapour and ice into space.'
    },
    zh: {
      name: '木卫二', type: '木星的冰质卫星', fact: '冰壳下存在海洋的有力证据',
      invitation: '沿着浅色冰世界上的长裂纹探索。',
      story: '科学家发现了木卫二冰壳下存在咸水海洋的有力证据，表面可见红褐色线条与破碎地形。场景采用有归属、经过缩小的 NASA 可视化模型底图，不把拼接底图当作实测高程，也没有透视冰层；细微起伏、光照、位置、比例与动态为艺术化表达。',
      observation: '继续靠近，追踪成对的脊与交叉裂纹；环视后返回木星，或比较另一颗冰质卫星。',
      nextReason: '去看一颗向太空释放水汽与冰粒的土星卫星。'
    }
  },
  {
    key: 'enceladus', target: 'Enceladus', bodyKind: 'moon', spaceRegion: 'solar-system',
    mapSourceLabel: 'NASA/JPL-Caltech/SSI/LPI · enhanced colour, cropped', mapSourceUrl: 'https://science.nasa.gov/photojournal/color-maps-of-enceladus-2014/',
    nextTarget: 'Titan', color: '#c5e1ed', sourceLabel: 'NASA', sourceUrl: 'https://science.nasa.gov/saturn/moons/enceladus/',
    en: {
      name: 'Enceladus', type: 'Saturn’s active ice moon', fact: 'Water vapour and ice jets · An ocean below',
      invitation: 'Look beneath a bright ice world for a delicate polar plume.',
      story: 'Enceladus has bright ice and jets of water vapour and ice particles that give clues to its subsurface ocean. The surface uses a cropped and resized historical Cassini colour mosaic. Its enhanced colours include ultraviolet and infrared wavelengths and are not natural colour. Fine relief, polar fans and motion are artistic illustrations, not measured elevation or current activity; the small moon is enlarged for exploration.',
      observation: 'Orbit toward the south pole to trace the plume back to the ice, pause its motion and return to Saturn.',
      nextReason: 'Compare bright exposed ice with a moon hidden in thick haze.'
    },
    zh: {
      name: '土卫二', type: '土星的活跃冰卫星', fact: '水汽与冰粒喷流 · 地下海洋',
      invitation: '在明亮冰世界下方，寻找轻盈的极地喷流。',
      story: '土卫二明亮的冰面与水汽、冰粒喷流为地下海洋提供了线索。表面采用裁切与缩小的 Cassini 历史地图，增强色彩包含紫外与红外波段，并非自然色。细微起伏、极地喷流与动态为艺术化示意，不是实测高程或当前活动；这颗小卫星经过放大，便于探索。',
      observation: '转向南极，沿喷流追溯到冰壳，暂停观察它的层次，再返回土星。',
      nextReason: '从裸露的明亮冰面，转向被厚霾包围的卫星。'
    }
  },
  {
    key: 'titan', target: 'Titan', bodyKind: 'moon', spaceRegion: 'solar-system',
    nextTarget: 'Venus', color: '#d5a15d', sourceLabel: 'NASA', sourceUrl: 'https://science.nasa.gov/saturn/moons/titan/',
    observationSourceLabel: 'NASA · Cassini ultraviolet observations', observationSourceUrl: 'https://science.nasa.gov/photojournal/titans-hazes/',
    en: {
      name: 'Titan', type: 'Saturn’s largest moon', fact: 'Thick atmosphere · Liquid hydrocarbon lakes',
      invitation: 'Approach a moon hidden beneath amber haze.',
      story: 'Titan has a substantial atmosphere and a cycle of methane and ethane clouds, rain, rivers and lakes. Visible light encounters thick haze. The haze layers and polar tint here are authored illustrations, not current weather or a surface map; the hidden lakes are not depicted.',
      observation: 'Observe subtle haze layers and the cooler polar tint. Orbit toward the limb, then return to Saturn.',
      representationNote: 'Enhanced detached haze is inspired by ultraviolet observations; colour and layer thickness are artistic, and the solid surface remains hidden.',
      nextReason: 'Compare two worlds whose solid surfaces are hidden by thick atmospheres.'
    },
    zh: {
      name: '土卫六', type: '土星最大的卫星', fact: '厚大气 · 液态碳氢化合物湖泊',
      invitation: '接近一个藏在琥珀色霾层中的世界。',
      story: '土卫六拥有浓厚大气，甲烷与乙烷参与云、降雨、河流和湖泊的循环。可见光面对的是厚霾。这里的霾层与极地色调是设计的示意，并非当前天气或地表地图；没有把隐藏的湖泊直接画在霾层上。',
      observation: '观察细微霾层与较冷的极地色调，环视边缘，再返回土星。',
      representationNote: '增强的分离霾层参考紫外线观测；色彩与层厚为艺术表达，固体地表仍被遮住。',
      nextReason: '比较两颗固体地表被厚大气隐藏的天体。'
    }
  }
];

SATELLITE_NOTES.push({
  "key": "ganymede",
  "target": "Ganymede",
  "bodyKind": "moon",
  "spaceRegion": "solar-system",
  "nextTarget": "Callisto",
  "color": "#a9a296",
  "sourceLabel": "NASA",
  "sourceUrl": "https://science.nasa.gov/jupiter/jupiter-moons/ganymede/",
  "mapSourceLabel": "NASA VTAD · visualization texture",
  "mapSourceUrl": "https://science.nasa.gov/resource/ganymede-3d-model/",
  "en": {
    "name": "Ganymede",
    "type": "Jupiter’s largest moon",
    "fact": "Largest moon in the Solar System · Its own magnetic field",
    "invitation": "Explore bright grooved terrain beside older dark regions.",
    "story": "Ganymede is the largest moon in the Solar System and has its own magnetic field. Bright grooved terrain contrasts with darker, heavily cratered regions. The surface uses the credited NASA visualization-model texture, resized for display. Fine relief, illumination, rotation and compressed spacing are artistic; the map is not measured height or a view of its interior.",
    "observation": "Approach the boundaries between bright grooves and dark terrain, then orbit and return to Jupiter or visit Callisto.",
    "nextReason": "Compare bright grooved terrain with a darker, densely cratered neighbour."
  },
  "zh": {
    "name": "木卫三",
    "type": "木星最大的卫星",
    "fact": "太阳系最大的卫星 · 拥有自身磁场",
    "invitation": "探索明亮沟槽地貌与古老暗色区域的交界。",
    "story": "木卫三是太阳系最大的卫星，拥有自身磁场。明亮的沟槽地貌与较暗、布满撞击坑的区域形成对比。表面使用有归属、经过缩小的 NASA 可视化模型底图；细微地形增强、光照、转动与压缩间距为艺术化表现，不把底图当作实测高程或内部透视。",
    "observation": "靠近亮色沟槽与暗色地貌的交界，环视后返回木星，或拜访木卫四。",
    "nextReason": "与更暗、密布撞击坑的邻居比较。"
  }
},{
  "key": "callisto",
  "target": "Callisto",
  "bodyKind": "moon",
  "spaceRegion": "solar-system",
  "nextTarget": "Ganymede",
  "color": "#918878",
  "sourceLabel": "NASA",
  "sourceUrl": "https://science.nasa.gov/jupiter/jupiter-moons/callisto/",
  "mapSourceLabel": "NASA VTAD · visualization texture",
  "mapSourceUrl": "https://science.nasa.gov/resource/callisto-3d-model/",
  "en": {
    "name": "Callisto",
    "type": "Jupiter’s cratered moon",
    "fact": "An ancient surface covered in impact scars",
    "invitation": "Find bright impact scars across a dark, ancient landscape.",
    "story": "Callisto’s old surface is densely covered in impact craters, preserving a long history of collisions. The scene uses the credited NASA visualization-model texture, resized for display. Fine relief, illumination, rotation and compressed spacing are artistic; this is not measured elevation or a reconstruction of current events.",
    "observation": "Approach the bright crater patterns against dark terrain. Pause and orbit, then return to Jupiter or compare Ganymede.",
    "nextReason": "Compare this old cratered landscape with Ganymede’s brighter grooved terrain."
  },
  "zh": {
    "name": "木卫四",
    "type": "木星的撞击坑卫星",
    "fact": "古老地表 · 密布撞击痕迹",
    "invitation": "在暗色的古老地貌上寻找明亮撞击痕迹。",
    "story": "木卫四古老的地表密布撞击坑，保留了漫长的碰撞历史。场景使用有归属、经过缩小的 NASA 可视化模型底图；细微地形增强、光照、转动与压缩间距为艺术化表现，并非实测高程或当前事件重建。",
    "observation": "靠近暗色地貌上的明亮撞击纹理，暂停并环视，然后返回木星或对照木卫三。",
    "nextReason": "与木卫三明亮的沟槽地貌比较。"
  }
});

SATELLITE_NOTES.push(...[
  {
    "key": "triton",
    "target": "Triton",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Enceladus",
    "color": "#bdc0c9",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/neptune/moons/triton/",
    "mapSourceLabel": "NASA VTAD · visualization texture",
    "mapSourceUrl": "https://science.nasa.gov/resource/triton-3d-model/",
    "en": {
      "name": "Triton",
      "type": "Neptune’s largest moon",
      "fact": "An icy world · A retrograde orbit",
      "invitation": "Leave the blue cloud tops for a pale, frozen companion.",
      "story": "Triton travels opposite to Neptune’s rotation. Voyager 2 observed icy plains and active geysers in 1989. The attributed NASA visualization texture has uneven detail and filled regions. Illumination, surface shading, rotation and the compressed retrograde path are artistic; this is not measured elevation or a live ephemeris.",
      "observation": "Approach the light ice and darker surface patterns, then return to Neptune and see their shared space.",
      "nextReason": "Compare another icy moon with observed plumes."
    },
    "zh": {
      "name": "海卫一",
      "type": "海王星最大的卫星",
      "fact": "冰冷的世界 · 逆行轨道",
      "invitation": "离开蓝色云顶，拜访它苍白的冰冷伴侣。",
      "story": "海卫一的轨道方向与海王星自转相反。旅行者二号在 1989 年观察到冰原与活跃喷泉。有归属的 NASA 可视化底图包含不同清晰度和填补区域；光照、地形增强、转动与压缩的逆行路径为艺术示意，并非实测高程或实时星历。",
      "observation": "靠近明亮冰层与较暗表面纹理，再返回海王星，观察它们的共同空间。",
      "nextReason": "与另一颗有喷流观测的冰卫星比较。"
    }
  },
  {
    "key": "mimas",
    "target": "Mimas",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Enceladus",
    "color": "#bcbeb0",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/mimas/",
    "mapSourceLabel": "NASA/JPL-Caltech/SSI/LPI · enhanced colour",
    "mapSourceUrl": "https://science.nasa.gov/photojournal/color-maps-of-mimas-2014/",
    "en": {
      "name": "Mimas",
      "type": "Saturn’s cratered ice moon",
      "fact": "Herschel crater · About 130 km across",
      "invitation": "Find the giant impact scar on a small icy world.",
      "story": "Herschel crater spans roughly a third of Mimas’ diameter. The 2014 Cassini mosaic combines enhanced ultraviolet, visible and infrared colour. Its existing shading is retained; the globe approximation, light, brightness-derived relief, rotation and spacing are artistic, not measured elevation or natural colour.",
      "observation": "Approach Herschel’s rim and the surrounding smaller craters. Orbit, withdraw and return to Saturn’s moon family.",
      "nextReason": "Compare the cratered landscape with Enceladus’ fractured ice."
    },
    "zh": {
      "name": "土卫一",
      "type": "土星的冰质撞击坑世界",
      "fact": "赫歇尔撞击坑 · 直径约 130 千米",
      "invitation": "在小小的冰世界上寻找巨大的撞击伤痕。",
      "story": "赫歇尔撞击坑横跨土卫一直径约三分之一。2014 年卡西尼底图融合增强的紫外、可见光与红外色彩，保留原有镶嵌明暗；球体近似、光照、亮度衍生的地形增强、转动与间距为艺术表现，并非实测高程或自然色。",
      "observation": "靠近赫歇尔坑缘及周围的小撞击坑，环视后退离并返回土星卫星家族。",
      "nextReason": "与土卫二布满裂纹的冰层比较。"
    }
  }
]);

SATELLITE_NOTES.push(...[
  {
    "key": "phobos",
    "shapeSourceLabel": "NASA/JPL-Caltech · 3D visualization",
    "shapeSourceUrl": "https://science.nasa.gov/resource/phobos-mars-moon-3d-model/",
    "target": "Phobos",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Deimos",
    "color": "#aaa397",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/mars/moons/phobos/",
    "mapSourceLabel": "NASA/JPL/USGS · Viking historical grayscale visualization map · 1440 × 720",
    "mapSourceUrl": "https://space.jpl.nasa.gov/tmaps/mars.html",
    "en": {
      "name": "Phobos",
      "type": "Mars’ rocky moon",
      "fact": "Mars’ larger moon · Stickney crater and long grooves",
      "invitation": "Discover a small world beside the red planet.",
      "story": "Phobos is the larger Martian moon; Stickney is its largest crater and grooves cross its surface. The historical Viking visualization map retains baked lighting, seams and low-detail patches; it is not complete measured terrain. The solid, including broad concave terrain, is simplified from NASA’s 3D visualization model and uniformly fitted inside the display proportions. The retained historical map is not registered to model UVs; these visualization assets and fine shading do not provide a new measured height layer. Lighting, brightness-derived relief, enlarged size, orientation and orbit spacing are artistic.",
      "observation": "Orbit the elongated outline, then approach the broad crater and grooves. Compare the smoother Deimos, or return to Mars’ family.",
      "nextReason": "Compare Deimos to see how the two Martian moons differ."
    },
    "zh": {
      "name": "火卫一",
      "type": "火星的岩质卫星",
      "fact": "火星较大的卫星 · 斯蒂克尼撞击坑与长沟槽",
      "invitation": "在红色行星旁，发现一个小世界。",
      "story": "火卫一是火星较大的卫星，斯蒂克尼是其最大的撞击坑，表面还有延伸的沟槽。历史 Viking 可视化底图保留原始明暗、拼接缝与低细节区域，不是完整的实测地形。实体及宽阔凹陷地形由 NASA 三维可视化模型简化而成，统一缩放至显示比例内；保留的历史底图未与原模型 UV 配准，可视化资产和细节受光也不提供新的实测高程层。受光、亮度衍生起伏、放大尺寸、朝向与轨道间距均为艺术表达。",
      "observation": "环视拉长的轮廓，继续靠近大撞击坑与沟槽；比较更平缓的火卫二，再返回火星家族。",
      "nextReason": "比较火卫二，观察两颗火星卫星的地貌差异。"
    }
  },
  {
    "key": "deimos",
    "shapeSourceLabel": "NASA/JPL-Caltech · 3D visualization",
    "shapeSourceUrl": "https://science.nasa.gov/resource/deimos-mars-moon-3d-model/",
    "target": "Deimos",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Phobos",
    "color": "#aaa397",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/mars/moons/deimos/",
    "mapSourceLabel": "NASA/JPL/USGS · Viking historical grayscale visualization map · 1440 × 720",
    "mapSourceUrl": "https://space.jpl.nasa.gov/tmaps/mars.html",
    "en": {
      "name": "Deimos",
      "type": "Mars’ rocky moon",
      "fact": "Mars’ smaller moon · Dust softens its cratered surface",
      "invitation": "Discover a small world beside the red planet.",
      "story": "Deimos is the smaller, less irregular Martian moon. Dust partly fills its craters and softens their appearance. The historical Viking visualization map retains baked lighting, seams and low-detail patches; it is not complete measured terrain. The solid, including broad concave terrain, is simplified from NASA’s 3D visualization model and uniformly fitted inside the display proportions. The retained historical map is not registered to model UVs; these visualization assets and fine shading do not provide a new measured height layer. Lighting, brightness-derived relief, enlarged size, orientation and orbit spacing are artistic.",
      "observation": "Approach the softer cratered terrain and orbit its asymmetric outline. Compare Phobos’ grooves, then return to Mars’ family.",
      "nextReason": "Compare Phobos to see how the two Martian moons differ."
    },
    "zh": {
      "name": "火卫二",
      "type": "火星的岩质卫星",
      "fact": "火星较小的卫星 · 尘土使撞击地貌更平缓",
      "invitation": "在红色行星旁，发现一个小世界。",
      "story": "火卫二更小、形状较圆润，尘土部分填平了撞击坑，使地貌显得更平缓。历史 Viking 可视化底图保留原始明暗、拼接缝与低细节区域，不是完整的实测地形。实体及宽阔凹陷地形由 NASA 三维可视化模型简化而成，统一缩放至显示比例内；保留的历史底图未与原模型 UV 配准，可视化资产和细节受光也不提供新的实测高程层。受光、亮度衍生起伏、放大尺寸、朝向与轨道间距均为艺术表达。",
      "observation": "接近平缓的撞击地貌，环视不对称的轮廓；比较火卫一的沟槽，再返回火星家族。",
      "nextReason": "比较火卫一，观察两颗火星卫星的地貌差异。"
    }
  }
]);

SATELLITE_NOTES.push(...[
  {
    "key": "miranda",
    "target": "Miranda",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Iapetus",
    "color": "#b7babc",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/uranus/moons/miranda/",
    "mapSourceLabel": "NASA/JPL/USGS · Voyager historical grayscale map · 1440 × 720 · partial coverage",
    "mapSourceUrl": "https://space.jpl.nasa.gov/tmaps/uranus.html",
    "en": {
      "name": "Miranda",
      "type": "Uranus’ fractured ice moon",
      "fact": "Patchwork coronae, ridges and deep fault canyons",
      "invitation": "Discover a fractured landscape beside Uranus.",
      "story": "Voyager 2 revealed broad coronae and fault canyons on Miranda. This historical USGS Voyager mosaic retains its grayscale, baked lighting and uneven detail. Only dark runs connected to the northern map edge are marked as missing coverage; those areas remain plain neutral grey. This conservative mask is not a measured footprint. The sphere, brightness-derived relief, lighting, enlarged size, rotation and parent-centred orbit are artistic, not measured elevation or an ephemeris.",
      "observation": "Approach the mapped southern terrain and trace the broad bands of ridges. Orbit to see the coverage boundary, then recover the common view with Uranus.",
      "nextReason": "Compare this fractured world with another moon’s dramatic bright and dark regions."
    },
    "zh": {
      "name": "天卫五",
      "type": "天王星的破裂冰质卫星",
      "fact": "拼接般的冕状构造、山脊与断层峡谷",
      "invitation": "在天王星旁，发现一个破裂的冰世界。",
      "story": "旅行者 2 号揭示了天卫五宽广的冕状构造与断层峡谷。这张 USGS 历史 Voyager 镶嵌图保留灰度、原有明暗与不均匀细节。只把与地图北侧边缘相连的黑色范围标作缺测，显示为平坦中性灰；这种保守遮罩不是实测覆盖足迹。球体近似、亮度衍生起伏、受光、放大尺寸、转动与围绕母星的示意轨道均为艺术表达，并非实测高程或星历。",
      "observation": "靠近已有地图的南侧地貌，追踪宽广的脊纹；环视辨认覆盖边界，再返回与天王星的共同视角。",
      "nextReason": "比较另一颗卫星强烈的明暗地貌分区。"
    }
  },
  {
    "key": "iapetus",
    "target": "Iapetus",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Miranda",
    "color": "#bbb0a0",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/iapetus/",
    "mapSourceLabel": "NASA/JPL-Caltech/SSI/LPI · Cassini 2014 enhanced colour · resized",
    "mapSourceUrl": "https://science.nasa.gov/photojournal/color-maps-of-iapetus-2014/",
    "en": {
      "name": "Iapetus",
      "type": "Saturn’s two-tone ice moon",
      "fact": "A dark leading hemisphere and a bright trailing hemisphere",
      "invitation": "Follow the mottled boundary between bright and dark terrain.",
      "story": "Iapetus has striking bright and dark hemispheres and an equatorial ridge. The full historical Cassini PIA18436 global mosaic is resized for display; its enhanced ultraviolet, visible and infrared colours are not natural colour. Original mosaic lighting, seams and low-detail patches remain. The spherical outline does not reconstruct the ridge’s height. Lighting, brightness-derived relief, enlarged size, rotation and inclined parent-centred orbit are artistic, not elevation or an ephemeris.",
      "observation": "Approach the mottled bright/dark boundary and the cratered bright terrain. Orbit to compare both regions, then return to Saturn and its other moons.",
      "nextReason": "Compare hemispheric colour contrast with Miranda’s bands of fractured terrain."
    },
    "zh": {
      "name": "土卫八",
      "type": "土星的明暗双色冰质卫星",
      "fact": "朝前的暗色半球与朝后的亮色半球",
      "invitation": "沿斑驳的边界，探索明暗两种地貌。",
      "story": "土卫八拥有明暗差异鲜明的半球，以及赤道山脊。场景完整缩小历史卡西尼 PIA18436 全球镶嵌图；增强的紫外、可见光与红外色彩不是自然色，原有明暗、拼接缝与低细节区域仍被保留。球体轮廓没有重建山脊高度；受光、亮度衍生起伏、放大尺寸、转动与倾斜的母星中心轨道均为艺术表达，并非高程或星历。",
      "observation": "靠近斑驳的明暗边界与亮区撞击坑，环视比较两个区域，再返回土星及其他卫星。",
      "nextReason": "将半球明暗对比，与天卫五破裂地貌的条带进行比较。"
    }
  }
]);

SATELLITE_NOTES.push(...[
  {
    "key": "ariel",
    "target": "Ariel",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Umbriel",
    "color": "#b3b5b8",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/uranus/moons/ariel/",
    "mapSourceLabel": "NASA/JPL/USGS · Voyager historical grayscale map · 1440 × 720 · partial coverage",
    "mapSourceUrl": "https://maps.jpl.nasa.gov/tmaps/uranus.html",
    "en": {
      "name": "Ariel",
      "type": "Uranus’ faulted ice moon",
      "fact": "Fault-bounded valleys cross the icy surface",
      "invitation": "Trace branching valleys on a small icy world.",
      "story": "Ariel is a mixture of ice and rock. Voyager 2 revealed broad fault-bounded valleys and a surface with relatively few large craters. This historical USGS Voyager mosaic retains grayscale, baked lighting and uneven detail. Dark runs connected to the northern map edge are conservatively marked as missing and shown as flat neutral grey; the mask is not a measured footprint. The sphere, brightness-derived relief, illumination, enlarged size, orientation, rotation and parent-centred orbit are artistic, not elevation or an ephemeris.",
      "observation": "Approach the mapped southern valleys, orbit to see their connections, then recover the common view around Uranus.",
      "nextReason": "Compare the faulted terrain with Umbriel’s darker cratered surface."
    },
    "zh": {
      "name": "天卫一",
      "type": "天王星的断裂冰质卫星",
      "fact": "冰壳上交错的断层谷地",
      "invitation": "沿分叉的谷地，探索小小的冰世界。",
      "story": "天卫一由冰与岩石组成。旅行者 2 号揭示了宽广的断层谷地，表面大型撞击坑相对较少。 这张 USGS 历史 Voyager 镶嵌图保留灰度、原有明暗与不均匀细节。与地图北侧边缘相连的暗色范围保守标作缺测，显示为平坦中性灰；遮罩不是实测覆盖足迹。球体、亮度衍生起伏、受光、放大尺寸、朝向、转动和母星中心轨道均为艺术表达，并非高程或星历。",
      "observation": "靠近有地图的南侧谷地，环视观察它们如何连接，再返回天王星的共同视角。",
      "nextReason": "比较天卫二较暗的撞击地貌。"
    }
  },
  {
    "key": "umbriel",
    "target": "Umbriel",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Titania",
    "color": "#73777a",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/uranus/moons/umbriel/",
    "mapSourceLabel": "NASA/JPL/USGS · Voyager historical grayscale map · 1440 × 720 · partial coverage",
    "mapSourceUrl": "https://maps.jpl.nasa.gov/tmaps/uranus.html",
    "en": {
      "name": "Umbriel",
      "type": "Uranus’ dark cratered moon",
      "fact": "Ancient cratered terrain · A distinctive bright ring",
      "invitation": "Look for contrast on a dark, old world.",
      "story": "Umbriel is the darkest of Uranus’ major moons. Voyager 2 imaged ancient cratered southern terrain and a distinctive bright ring whose origin remains uncertain. The mapped terrain receives an artistic dark tint, not a reconstruction of measured reflectance. This historical USGS Voyager mosaic retains grayscale, baked lighting and uneven detail. Dark runs connected to the northern map edge are conservatively marked as missing and shown as flat neutral grey; the mask is not a measured footprint. The sphere, brightness-derived relief, illumination, enlarged size, orientation, rotation and parent-centred orbit are artistic, not elevation or an ephemeris.",
      "observation": "Approach the mapped cratered terrain, compare bright patches with dark surroundings, then return to Uranus and its other moons.",
      "nextReason": "Compare Titania’s larger fractured landscape."
    },
    "zh": {
      "name": "天卫二",
      "type": "天王星的暗色撞击卫星",
      "fact": "古老撞击地貌 · 独特的亮环",
      "invitation": "在古老的暗色世界上，寻找明暗变化。",
      "story": "天卫二是天王星主要卫星中最暗的一颗。旅行者 2 号拍到了南侧古老的撞击地貌和一个成因尚不确定的独特亮环。已有地图的区域使用艺术化暗色调，并非实测反射率重建。 这张 USGS 历史 Voyager 镶嵌图保留灰度、原有明暗与不均匀细节。与地图北侧边缘相连的暗色范围保守标作缺测，显示为平坦中性灰；遮罩不是实测覆盖足迹。球体、亮度衍生起伏、受光、放大尺寸、朝向、转动和母星中心轨道均为艺术表达，并非高程或星历。",
      "observation": "靠近已有地图的撞击地貌，对照亮斑与暗色周围，再返回天王星和其他卫星。",
      "nextReason": "比较天卫三更大的断裂地貌。"
    }
  },
  {
    "key": "titania",
    "target": "Titania",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Oberon",
    "color": "#a5a7a9",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/uranus/moons/titania/",
    "mapSourceLabel": "NASA/JPL/USGS · Voyager historical grayscale map · 1440 × 720 · partial coverage",
    "mapSourceUrl": "https://maps.jpl.nasa.gov/tmaps/uranus.html",
    "en": {
      "name": "Titania",
      "type": "Uranus’ largest moon",
      "fact": "Long faults and troughs cut across cratered terrain",
      "invitation": "Follow a fracture through an icy landscape.",
      "story": "Titania is Uranus’ largest moon. Voyager 2 revealed craters crossed by long fault valleys and troughs, evidence that its surface experienced extension. This historical USGS Voyager mosaic retains grayscale, baked lighting and uneven detail. Dark runs connected to the northern map edge are conservatively marked as missing and shown as flat neutral grey; the mask is not a measured footprint. The sphere, brightness-derived relief, illumination, enlarged size, orientation, rotation and parent-centred orbit are artistic, not elevation or an ephemeris.",
      "observation": "Approach the mapped southern terrain and trace the larger dark troughs through the craters. Orbit, compare Oberon, or return to the shared family.",
      "nextReason": "Compare Oberon’s heavily cratered surface and bright rays."
    },
    "zh": {
      "name": "天卫三",
      "type": "天王星最大的卫星",
      "fact": "长断层与槽谷穿过撞击地貌",
      "invitation": "沿冰质地貌中的裂隙，寻找它的延伸。",
      "story": "天卫三是天王星最大的卫星。旅行者 2 号揭示了穿过撞击地貌的长断层谷地与槽谷，说明表面曾发生伸展。 这张 USGS 历史 Voyager 镶嵌图保留灰度、原有明暗与不均匀细节。与地图北侧边缘相连的暗色范围保守标作缺测，显示为平坦中性灰；遮罩不是实测覆盖足迹。球体、亮度衍生起伏、受光、放大尺寸、朝向、转动和母星中心轨道均为艺术表达，并非高程或星历。",
      "observation": "靠近已有地图的南侧地貌，追踪撞击坑之间较大的暗色槽谷；环视后比较天卫四，或返回共同家族。",
      "nextReason": "比较天卫四密集的撞击坑与明亮辐射纹。"
    }
  },
  {
    "key": "oberon",
    "target": "Oberon",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "nextTarget": "Miranda",
    "color": "#9da0a2",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/uranus/moons/oberon/",
    "mapSourceLabel": "NASA/JPL/USGS · Voyager historical grayscale map · 1440 × 720 · partial coverage",
    "mapSourceUrl": "https://maps.jpl.nasa.gov/tmaps/uranus.html",
    "en": {
      "name": "Oberon",
      "type": "Uranus’ outer cratered moon",
      "fact": "Dense craters, bright rays and dark crater floors",
      "invitation": "Explore the scars on an old icy world.",
      "story": "Oberon is Uranus’ second-largest moon, with a heavily cratered surface. Voyager images show bright rays and dark material on some crater floors; the historical mosaic has uneven resolution. This historical USGS Voyager mosaic retains grayscale, baked lighting and uneven detail. Dark runs connected to the northern map edge are conservatively marked as missing and shown as flat neutral grey; the mask is not a measured footprint. The sphere, brightness-derived relief, illumination, enlarged size, orientation, rotation and parent-centred orbit are artistic, not elevation or an ephemeris.",
      "observation": "Approach the mapped crater fields and their bright rays. Orbit to see the coverage boundary, then compare Miranda or return to Uranus.",
      "nextReason": "Compare cratered terrain with Miranda’s broad fractured bands."
    },
    "zh": {
      "name": "天卫四",
      "type": "天王星的外侧撞击卫星",
      "fact": "密集撞击坑、亮色辐射纹与暗色坑底",
      "invitation": "探索古老冰世界上的撞击痕迹。",
      "story": "天卫四是天王星第二大的卫星，表面遍布撞击坑。旅行者图像中可见亮色辐射纹，以及部分坑底的暗色物质；历史镶嵌图的分辨率并不均匀。 这张 USGS 历史 Voyager 镶嵌图保留灰度、原有明暗与不均匀细节。与地图北侧边缘相连的暗色范围保守标作缺测，显示为平坦中性灰；遮罩不是实测覆盖足迹。球体、亮度衍生起伏、受光、放大尺寸、朝向、转动和母星中心轨道均为艺术表达，并非高程或星历。",
      "observation": "靠近已有地图的撞击坑群与亮色辐射纹，环视辨认缺测边界，再比较天卫五或返回天王星。",
      "nextReason": "比较天卫五宽广的破裂地貌条带。"
    }
  }
]);

const REMOTE_WORLD_NOTES = [
  {
    "key": "hyperion",
    "target": "Hyperion",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Phoebe",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/hyperion/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#c5a887",
    "en": {
      "name": "Hyperion",
      "type": "Moon",
      "fact": "A porous-looking, deeply cratered moon",
      "spaceReference": "Within the Solar System",
      "invitation": "Explore the deep bowls, bright walls and dark floors; orbit its uneven silhouette.",
      "observation": "Explore the deep bowls, bright walls and dark floors; orbit its uneven silhouette.",
      "story": "Cassini revealed unusually deep craters on irregular Hyperion. Its porous appearance is associated with its low density. The shape, relief, colour, lighting, rotation, orbit, ring proportions and scene placement are authored illustrations, not measured terrain, registered spacecraft imagery or a live ephemeris.",
      "nextReason": "Compare with Phoebe."
    },
    "zh": {
      "name": "土卫七",
      "type": "卫星",
      "fact": "深坑蜂窝状的不规则卫星",
      "spaceReference": "太阳系内",
      "invitation": "接近深碗状坑、明亮坑壁和暗色坑底，环视不规则轮廓。",
      "observation": "接近深碗状坑、明亮坑壁和暗色坑底，环视不规则轮廓。",
      "story": "卡西尼观测到土卫七不规则形体上的深坑；疏松外观与其低密度有关。 这里的形状、起伏、颜色、受光、转动、轨道、环带比例与场景位置均为艺术示意，不是实测地形、地理配准的航天器影像或实时星历。",
      "nextReason": "继续对照另一种形体和空间结构。"
    },
    "aliases": [
      "土卫七"
    ]
  },
  {
    "key": "pan",
    "target": "Pan",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Atlas",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/pan/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#c5a887",
    "en": {
      "name": "Pan",
      "type": "Moon",
      "fact": "A small moon with an equatorial skirt",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the thin equatorial flange, then compare the broader saucer of Atlas.",
      "observation": "Orbit the thin equatorial flange, then compare the broader saucer of Atlas.",
      "story": "Pan orbits in the Encke Gap of Saturn’s A ring. Cassini images show a prominent equatorial ridge. The shape, relief, colour, lighting, rotation, orbit, ring proportions and scene placement are authored illustrations, not measured terrain, registered spacecraft imagery or a live ephemeris.",
      "nextReason": "Compare with Atlas."
    },
    "zh": {
      "name": "潘",
      "type": "卫星",
      "fact": "赤道带有裙边的小卫星",
      "spaceReference": "太阳系内",
      "invitation": "沿赤道薄裙边环视，再比较阿特拉斯更宽的飞碟轮廓。",
      "observation": "沿赤道薄裙边环视，再比较阿特拉斯更宽的飞碟轮廓。",
      "story": "潘位于土星 A 环的恩克缝中，卡西尼影像显示其突出的赤道脊。 这里的形状、起伏、颜色、受光、转动、轨道、环带比例与场景位置均为艺术示意，不是实测地形、地理配准的航天器影像或实时星历。",
      "nextReason": "继续对照另一种形体和空间结构。"
    },
    "aliases": [
      "潘",
      "土卫十八"
    ]
  },
  {
    "key": "atlas",
    "target": "Atlas",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Pan",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/atlas/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#c5a887",
    "en": {
      "name": "Atlas",
      "type": "Moon",
      "fact": "A broad saucer at Saturn’s A-ring edge",
      "spaceReference": "Within the Solar System",
      "invitation": "Turn from the pole to the side to see the broad equatorial skirt around a raised core.",
      "observation": "Turn from the pole to the side to see the broad equatorial skirt around a raised core.",
      "story": "Atlas orbits near the outer edge of Saturn’s A ring and has a distinctive equatorial ridge. The shape, relief, colour, lighting, rotation, orbit, ring proportions and scene placement are authored illustrations, not measured terrain, registered spacecraft imagery or a live ephemeris.",
      "nextReason": "Compare with Pan."
    },
    "zh": {
      "name": "阿特拉斯",
      "type": "卫星",
      "fact": "土星 A 环边缘的宽裙边卫星",
      "spaceReference": "太阳系内",
      "invitation": "从极向转到侧面，观察宽阔赤道裙边围绕隆起核心的形状。",
      "observation": "从极向转到侧面，观察宽阔赤道裙边围绕隆起核心的形状。",
      "story": "阿特拉斯在土星 A 环外缘附近运行，具有鲜明的赤道脊。 这里的形状、起伏、颜色、受光、转动、轨道、环带比例与场景位置均为艺术示意，不是实测地形、地理配准的航天器影像或实时星历。",
      "nextReason": "继续对照另一种形体和空间结构。"
    },
    "aliases": [
      "阿特拉斯",
      "土卫十五"
    ]
  },
  {
    "key": "phoebe",
    "target": "Phoebe",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Hyperion",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/phoebe/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#c5a887",
    "en": {
      "name": "Phoebe",
      "type": "Moon",
      "fact": "A dark, retrograde outer moon",
      "spaceReference": "Within the Solar System",
      "invitation": "Approach a dim rugged surface, orbit its worn basins, then return to Saturn’s family.",
      "observation": "Approach a dim rugged surface, orbit its worn basins, then return to Saturn’s family.",
      "story": "Phoebe is a very dark outer moon of Saturn with a retrograde orbit. Cassini passed it on the way into the Saturn system. The shape, relief, colour, lighting, rotation, orbit, ring proportions and scene placement are authored illustrations, not measured terrain, registered spacecraft imagery or a live ephemeris.",
      "nextReason": "Compare with Hyperion."
    },
    "zh": {
      "name": "土卫九",
      "type": "卫星",
      "fact": "暗色逆行的外侧卫星",
      "spaceReference": "太阳系内",
      "invitation": "接近暗色粗糙表面与磨损盆地，再返回土星家族。",
      "observation": "接近暗色粗糙表面与磨损盆地，再返回土星家族。",
      "story": "土卫九是土星一颗表面很暗、轨道逆行的外侧卫星，卡西尼进入土星系统前曾近距离飞越。 这里的形状、起伏、颜色、受光、转动、轨道、环带比例与场景位置均为艺术示意，不是实测地形、地理配准的航天器影像或实时星历。",
      "nextReason": "继续对照另一种形体和空间结构。"
    },
    "aliases": [
      "土卫九"
    ]
  },
  {
    "key": "nereid",
    "target": "Nereid",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Triton",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/neptune/moons/nereid/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#c5a887",
    "en": {
      "name": "Nereid",
      "type": "Moon",
      "fact": "A distant moon on a strongly elliptical orbit",
      "spaceReference": "Within the Solar System",
      "invitation": "Observe the cool, restrained surface illustration, then compare Triton and return to Neptune.",
      "observation": "Observe the cool, restrained surface illustration, then compare Triton and return to Neptune.",
      "story": "Nereid is an outer moon of Neptune with a highly eccentric orbit. A detailed resolved surface map is unavailable here. The shape, relief, colour, lighting, rotation, orbit, ring proportions and scene placement are authored illustrations, not measured terrain, registered spacecraft imagery or a live ephemeris.",
      "nextReason": "Compare with Triton.",
      "representationNote": "Illustrative surface; no resolved terrain map."
    },
    "zh": {
      "name": "海卫二",
      "type": "卫星",
      "fact": "轨道高度椭圆的远方卫星",
      "spaceReference": "太阳系内",
      "invitation": "观察冷灰色表面示意，再比较海卫一并返回海王星。",
      "observation": "观察冷灰色表面示意，再比较海卫一并返回海王星。",
      "story": "海卫二是海王星的外侧卫星，轨道高度椭圆；这里没有它的详尽表面地图。 这里的形状、起伏、颜色、受光、转动、轨道、环带比例与场景位置均为艺术示意，不是实测地形、地理配准的航天器影像或实时星历。",
      "nextReason": "继续对照另一种形体和空间结构。",
      "representationNote": "表面为艺术示意，无已解析地形图。"
    },
    "aliases": [
      "海卫二"
    ]
  },
  {
    "key": "arrokoth",
    "target": "Arrokoth",
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "67P/Churyumov-Gerasimenko",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/solar-system/kuiper-belt/arrokoth-2014-mu69/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#c5a887",
    "en": {
      "name": "Arrokoth",
      "type": "Small world",
      "fact": "A red, flattened contact binary",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the two flattened lobes and pale neck, then compare the more angular comet 67P.",
      "observation": "Orbit the two flattened lobes and pale neck, then compare the more angular comet 67P.",
      "story": "New Horizons visited Arrokoth in 2019 and revealed two joined, flattened lobes and a red surface. The shape, relief, colour, lighting, rotation, orbit, ring proportions and scene placement are authored illustrations, not measured terrain, registered spacecraft imagery or a live ephemeris.",
      "nextReason": "Compare with 67P/Churyumov-Gerasimenko."
    },
    "zh": {
      "name": "阿罗科斯",
      "type": "小天体",
      "fact": "红色而扁平的接触双叶天体",
      "spaceReference": "太阳系内",
      "invitation": "环视扁平双叶与浅色颈部，再对照棱角更强的 67P 彗星。",
      "observation": "环视扁平双叶与浅色颈部，再对照棱角更强的 67P 彗星。",
      "story": "新视野号于 2019 年飞越阿罗科斯，发现其相连而扁平的双叶与红色表面。 这里的形状、起伏、颜色、受光、转动、轨道、环带比例与场景位置均为艺术示意，不是实测地形、地理配准的航天器影像或实时星历。",
      "nextReason": "继续对照另一种形体和空间结构。"
    },
    "aliases": [
      "2014 MU69",
      "阿罗科斯",
      "天涯海角",
      "486958 Arrokoth"
    ]
  },
  {
    "key": "chariklo",
    "target": "Chariklo",
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Quaoar",
    "sourceLabel": "ESO",
    "sourceUrl": "https://www.eso.org/public/news/eso1410/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#c5a887",
    "en": {
      "name": "Chariklo",
      "type": "Small world",
      "fact": "A small Centaur with two narrow rings",
      "spaceReference": "Within the Solar System",
      "invitation": "Approach the twin rings, orbit the open gap, and compare a more distant ring around Quaoar.",
      "observation": "Approach the twin rings, orbit the open gap, and compare a more distant ring around Quaoar.",
      "story": "Stellar occultations revealed two narrow rings around Chariklo, a Centaur orbiting between Saturn and Uranus. The shape, relief, colour, lighting, rotation, orbit, ring proportions and scene placement are authored illustrations, not measured terrain, registered spacecraft imagery or a live ephemeris.",
      "nextReason": "Compare with Quaoar.",
      "representationNote": "Illustrative surface; no resolved terrain map. Ring widths, brightness and distance are enhanced or compressed for exploration."
    },
    "zh": {
      "name": "女凯龙星",
      "type": "小天体",
      "fact": "带两条窄环的半人马小天体",
      "spaceReference": "太阳系内",
      "invitation": "接近两条细环，环视中间的空隙，再比较夸瓦尔更远的环。",
      "observation": "接近两条细环，环视中间的空隙，再比较夸瓦尔更远的环。",
      "story": "恒星掩星观测揭示了女凯龙星周围的两条窄环；它是运行在土星与天王星之间的半人马小天体。 这里的形状、起伏、颜色、受光、转动、轨道、环带比例与场景位置均为艺术示意，不是实测地形、地理配准的航天器影像或实时星历。",
      "nextReason": "继续对照另一种形体和空间结构。",
      "representationNote": "表面为艺术示意，无已解析地形图；环宽、亮度与距离为探索适当增强或压缩。"
    },
    "aliases": [
      "女凯龙星",
      "10199 Chariklo"
    ]
  },
  {
    "key": "sedna",
    "target": "Sedna",
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Eris",
    "sourceLabel": "NASA/JPL",
    "sourceUrl": "https://www.jpl.nasa.gov/news/most-distant-object-in-solar-system-discovered/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#c5a887",
    "en": {
      "name": "Sedna",
      "type": "Distant minor world",
      "fact": "A reddish world far beyond Neptune",
      "spaceReference": "Within the Solar System",
      "invitation": "Explore restrained red terrain, read what remains unknown, then compare Eris.",
      "observation": "Explore restrained red terrain, read what remains unknown, then compare Eris.",
      "story": "Sedna is a reddish, very distant trans-Neptunian object on an elongated orbit. Its detailed surface remains unresolved in this presentation. The shape, relief, colour, lighting, rotation, orbit, ring proportions and scene placement are authored illustrations, not measured terrain, registered spacecraft imagery or a live ephemeris.",
      "nextReason": "Compare with Eris.",
      "representationNote": "Illustrative surface; no resolved terrain map."
    },
    "zh": {
      "name": "塞德娜",
      "type": "海王星外天体",
      "fact": "海王星之外的红色遥远世界",
      "spaceReference": "太阳系内",
      "invitation": "探索克制的红色地表示意，阅读尚未知的部分，再比较阋神星。",
      "observation": "探索克制的红色地表示意，阅读尚未知的部分，再比较阋神星。",
      "story": "塞德娜是一颗颜色偏红、轨道拉长的遥远海王星外天体；这里没有其已解析的表面地貌。 这里的形状、起伏、颜色、受光、转动、轨道、环带比例与场景位置均为艺术示意，不是实测地形、地理配准的航天器影像或实时星历。",
      "nextReason": "继续对照另一种形体和空间结构。",
      "representationNote": "表面为艺术示意，无已解析地形图。"
    },
    "aliases": [
      "塞德娜",
      "90377 Sedna",
      "赛德娜"
    ]
  },
  {
  "key": "quaoar",
  "target": "Quaoar",
  "bodyKind": "dwarfplanet",
  "spaceRegion": "solar-system",
  "spaceSource": "body",
  "nextTarget": "Weywot",
  "sourceLabel": "ESA",
  "sourceUrl": "https://www.esa.int/Science_Exploration/Space_Science/Cheops/ESA_s_Cheops_finds_an_unexpected_ring_around_dwarf_planet_Quaoar",
  "mapSourceLabel": "程序示意 · Procedural illustration",
  "color": "#c5a887",
  "en": {
    "name": "Quaoar",
    "type": "Distant minor world",
    "fact": "A distant small world surrounded by a far ring",
    "spaceReference": "Within the Solar System",
    "invitation": "Observe the separation between the core and thin outer ring, turn the view, then compare Chariklo.",
    "observation": "Observe the separation between the core and thin outer ring, turn the view, then compare Chariklo.",
    "story": "Occultation observations including Cheops detected a ring around Quaoar far outside the expected Roche boundary. The shape, relief, colour, lighting, rotation, orbit, ring proportions and scene placement are authored illustrations, not measured terrain, registered spacecraft imagery or a live ephemeris.",
    "nextReason": "Meet Weywot, then return to the ringed parent.",
    "representationNote": "Illustrative surface; no resolved terrain map. Ring widths, brightness and distance are enhanced or compressed for exploration."
  },
  "zh": {
    "name": "夸瓦尔",
    "type": "海王星外天体",
    "fact": "被远距离环带围绕的小世界",
    "spaceReference": "太阳系内",
    "invitation": "观察核心与细外环之间的空旷距离，转动视角，再比较女凯龙星。",
    "observation": "观察核心与细外环之间的空旷距离，转动视角，再比较女凯龙星。",
    "story": "包括 Cheops 在内的掩星观测发现夸瓦尔的环远在预期洛希边界之外。 这里的形状、起伏、颜色、受光、转动、轨道、环带比例与场景位置均为艺术示意，不是实测地形、地理配准的航天器影像或实时星历。",
    "nextReason": "拜访 Weywot，再返回带环的母体。",
    "representationNote": "表面为艺术示意，无已解析地形图；环宽、亮度与距离为探索适当增强或压缩。"
  },
  "aliases": [
    "夸瓦尔",
    "50000 Quaoar"
  ]
}
];
DESTINATIONS.push(...REMOTE_WORLD_NOTES.filter(note=>['hyperion','arrokoth','chariklo'].includes(note.key)));

const SMALL_SATELLITE_NOTES = [

  {
    "key": "styx",
    "target": "Styx",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Nix",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/dwarf-planets/pluto/moons/styx/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "冥卫五",
      "S/2012 (134340) 1"
    ],
    "color": "#a1a8a8",
    "en": {
      "name": "Styx",
      "type": "Moon",
      "fact": "A tiny elongated moon beyond Charon",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the narrow shoulder, withdraw to Pluto’s family, then compare Nix.",
      "observation": "Orbit the narrow shoulder, withdraw to Pluto’s family, then compare Nix.",
      "story": "Hubble discovered Styx in 2012 while searching for hazards along New Horizons’ route. New Horizons later revealed an elongated small moon. Shape, fine geography, colour, illumination, rotation and compressed parent-centred orbit are artistic illustrations, not an acquired mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Continue the comparison within this moon family.",
      "representationNote": "Authored surface and shape; no complete measured terrain map. Orbits and sizes are compressed for exploration."
    },
    "zh": {
      "name": "冥卫五",
      "type": "卫星",
      "fact": "卡戎轨道外的细长小卫星",
      "spaceReference": "太阳系内",
      "invitation": "环视窄长的肩部，退回冥王星家族，再与冥卫二比较。",
      "observation": "环视窄长的肩部，退回冥王星家族，再与冥卫二比较。",
      "story": "哈勃在 2012 年为新视野号搜寻航路风险时发现冥卫五；之后新视野号揭示了它细长的小天体轮廓。形体、精细地貌、色彩、受光、转动与压缩的母体中心轨道为艺术示意，不是取得的任务网格、实测地形或实时星历。",
      "nextReason": "继续比较同一家族的不同成员。",
      "representationNote": "表面与形体为艺术创作，无完整实测地形图；轨道与大小为探索压缩。"
    }
  },
  {
    "key": "nix",
    "target": "Nix",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Kerberos",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/dwarf-planets/pluto/moons/nix/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "冥卫二",
      "S/2005 P 2"
    ],
    "color": "#b2ab9e",
    "en": {
      "name": "Nix",
      "type": "Moon",
      "fact": "A pale irregular moon with a reddish surface mark",
      "spaceReference": "Within the Solar System",
      "invitation": "Find the red region on the pale shoulder, follow the shallow hollows, then compare Kerberos.",
      "observation": "Find the red region on the pale shoulder, follow the shallow hollows, then compare Kerberos.",
      "story": "Hubble discovered Nix in 2005. New Horizons’ enhanced-colour images show a reddish mark on an otherwise pale irregular moon. The red region here is an artistic placement inspired by that observation, not a registered colour map. Shape, fine geography, colour, illumination, rotation and compressed parent-centred orbit are artistic illustrations, not an acquired mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Continue the comparison within this moon family.",
      "representationNote": "Authored surface and shape; no complete measured terrain map. Orbits and sizes are compressed for exploration."
    },
    "zh": {
      "name": "冥卫二",
      "type": "卫星",
      "fact": "浅色不规则卫星 · 观测到偏红区域",
      "spaceReference": "太阳系内",
      "invitation": "寻找浅色肩部上的红色区域，沿浅凹陷接近，再对照冥卫四。",
      "observation": "寻找浅色肩部上的红色区域，沿浅凹陷接近，再对照冥卫四。",
      "story": "哈勃在 2005 年发现冥卫二。新视野号增强色图像在其浅色不规则表面显示了偏红区域；这里的红色区域借鉴这一观察，位置为艺术示意，未配准为色彩地图。形体、精细地貌、色彩、受光、转动与压缩的母体中心轨道为艺术示意，不是取得的任务网格、实测地形或实时星历。",
      "nextReason": "继续比较同一家族的不同成员。",
      "representationNote": "表面与形体为艺术创作，无完整实测地形图；轨道与大小为探索压缩。"
    }
  },
  {
    "key": "kerberos",
    "target": "Kerberos",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Hydra",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/dwarf-planets/pluto/moons/kerberos/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "冥卫四",
      "S/2011 (134340) 1"
    ],
    "color": "#adada1",
    "en": {
      "name": "Kerberos",
      "type": "Moon",
      "fact": "Two unequal lobes on a reflective small moon",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the two unequal lobes and their joined waist, then compare Hydra’s uneven shoulders.",
      "observation": "Orbit the two unequal lobes and their joined waist, then compare Hydra’s uneven shoulders.",
      "story": "Hubble discovered Kerberos in 2011. New Horizons revealed two unequal lobes and a more reflective surface than earlier expectations. A merger of two bodies is one proposed origin. Shape, fine geography, colour, illumination, rotation and compressed parent-centred orbit are artistic illustrations, not an acquired mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Continue the comparison within this moon family.",
      "representationNote": "Authored surface and shape; no complete measured terrain map. Orbits and sizes are compressed for exploration."
    },
    "zh": {
      "name": "冥卫四",
      "type": "卫星",
      "fact": "两片大小不同的叶瓣 · 反光的小卫星",
      "spaceReference": "太阳系内",
      "invitation": "环视大小不同的双叶与相连腰部，再对照冥卫三起伏的肩部。",
      "observation": "环视大小不同的双叶与相连腰部，再对照冥卫三起伏的肩部。",
      "story": "哈勃在 2011 年发现冥卫四。新视野号揭示了大小不同的双叶，以及比早期预期更反光的表面；两个小天体合并是其可能成因之一。形体、精细地貌、色彩、受光、转动与压缩的母体中心轨道为艺术示意，不是取得的任务网格、实测地形或实时星历。",
      "nextReason": "继续比较同一家族的不同成员。",
      "representationNote": "表面与形体为艺术创作，无完整实测地形图；轨道与大小为探索压缩。"
    }
  },
  {
    "key": "hydra",
    "target": "Hydra",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Pluto",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/dwarf-planets/pluto/moons/hydra/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "冥卫三",
      "S/2005 P 1"
    ],
    "color": "#babfb2",
    "en": {
      "name": "Hydra",
      "type": "Moon",
      "fact": "An irregular outer member of Pluto’s moon family",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow the uneven broad shoulders, orbit the shallow valleys, then return to Pluto.",
      "observation": "Follow the uneven broad shoulders, orbit the shallow valleys, then return to Pluto.",
      "story": "Hubble discovered Hydra alongside Nix in 2005. Hydra is the outer of those two discoveries; New Horizons later imaged its irregular outline. Shape, fine geography, colour, illumination, rotation and compressed parent-centred orbit are artistic illustrations, not an acquired mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Continue the comparison within this moon family.",
      "representationNote": "Authored surface and shape; no complete measured terrain map. Orbits and sizes are compressed for exploration."
    },
    "zh": {
      "name": "冥卫三",
      "type": "卫星",
      "fact": "冥王星卫星家族外侧的不规则成员",
      "spaceReference": "太阳系内",
      "invitation": "观察不对称的宽肩与浅谷，环视后返回冥王星。",
      "observation": "观察不对称的宽肩与浅谷，环视后返回冥王星。",
      "story": "哈勃在 2005 年同时发现冥卫三与冥卫二，其中冥卫三位于外侧；新视野号之后拍摄了它不规则的轮廓。形体、精细地貌、色彩、受光、转动与压缩的母体中心轨道为艺术示意，不是取得的任务网格、实测地形或实时星历。",
      "nextReason": "继续比较同一家族的不同成员。",
      "representationNote": "表面与形体为艺术创作，无完整实测地形图；轨道与大小为探索压缩。"
    }
  },
  {
    "key": "dysnomia",
    "target": "Dysnomia",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Eris",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/resource/hubble-view-of-eris-and-dysnomia/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "阋卫一",
      "S/2005 (2003 UB313) 1"
    ],
    "color": "#42474c",
    "en": {
      "name": "Dysnomia",
      "type": "Moon",
      "fact": "The small companion that helped weigh Eris",
      "spaceReference": "Within the Solar System",
      "invitation": "Observe subdued grey relief, withdraw to the bright parent, then return to Eris.",
      "observation": "Observe subdued grey relief, withdraw to the bright parent, then return to Eris.",
      "story": "Hubble and Keck observations of Dysnomia’s orbit were combined to estimate Eris’ mass. These distant images do not supply a resolved surface or shape model; the dark-grey sphere and relief here are hypotheses for exploration. Shape, fine geography, colour, illumination, rotation and compressed parent-centred orbit are artistic illustrations, not an acquired mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Continue the comparison within this moon family.",
      "representationNote": "Authored surface and shape; no complete measured terrain map. Orbits and sizes are compressed for exploration."
    },
    "zh": {
      "name": "阋卫一",
      "type": "卫星",
      "fact": "帮助测量阋神星质量的小伴侣",
      "spaceReference": "太阳系内",
      "invitation": "近观暗灰色起伏，退离寻找明亮母体，再返回阋神星。",
      "observation": "近观暗灰色起伏，退离寻找明亮母体，再返回阋神星。",
      "story": "研究者结合哈勃与凯克望远镜对阋卫一轨道的观察，估算阋神星的质量。远距离图像没有提供已解析表面或形状模型；这里的暗灰色球体与起伏是假设性的探索表达。形体、精细地貌、色彩、受光、转动与压缩的母体中心轨道为艺术示意，不是取得的任务网格、实测地形或实时星历。",
      "nextReason": "继续比较同一家族的不同成员。",
      "representationNote": "表面与形体为艺术创作，无完整实测地形图；轨道与大小为探索压缩。"
    }
  },
  {
    "key": "hiiaka",
    "target": "Hiʻiaka",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Namaka",
    "sourceLabel": "NASA",
    "sourceUrl": "https://starchild.gsfc.nasa.gov/docs/StarChild/solar_system_level2/haumea.html",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "Hiiaka",
      "Hi'iaka",
      "Hi’iaka",
      "妊卫一"
    ],
    "color": "#b0c2c9",
    "en": {
      "name": "Hiʻiaka",
      "type": "Moon",
      "fact": "The larger of Haumea’s two known moons",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow pale blue ice regions, return to the elongated parent, then compare smaller Namaka.",
      "observation": "Follow pale blue ice regions, return to the elongated parent, then compare smaller Namaka.",
      "story": "NASA’s StarChild describes Hiʻiaka as Haumea’s larger moon and Namaka as the smaller one. Their names refer to Haumea’s children in Hawaiian mythology. This view has no resolved satellite surface map; the ice colours and landforms are authored. Shape, fine geography, colour, illumination, rotation and compressed parent-centred orbit are artistic illustrations, not an acquired mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Continue the comparison within this moon family.",
      "representationNote": "Authored surface and shape; no complete measured terrain map. Orbits and sizes are compressed for exploration."
    },
    "zh": {
      "name": "妊卫一",
      "type": "卫星",
      "fact": "妊神星两颗已知卫星中较大的一颗",
      "spaceReference": "太阳系内",
      "invitation": "沿浅蓝冰色区域接近，回望细长母体，再与较小的妊卫二比较。",
      "observation": "沿浅蓝冰色区域接近，回望细长母体，再与较小的妊卫二比较。",
      "story": "NASA StarChild 介绍妊卫一是妊神星较大的卫星，妊卫二则较小；名字来自夏威夷神话中妊神的孩子。这里没有已解析的卫星表面地图；冰色与地貌为艺术创作。形体、精细地貌、色彩、受光、转动与压缩的母体中心轨道为艺术示意，不是取得的任务网格、实测地形或实时星历。",
      "nextReason": "继续比较同一家族的不同成员。",
      "representationNote": "表面与形体为艺术创作，无完整实测地形图；轨道与大小为探索压缩。"
    }
  },
  {
    "key": "namaka",
    "target": "Namaka",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Hiʻiaka",
    "sourceLabel": "NASA",
    "sourceUrl": "https://starchild.gsfc.nasa.gov/docs/StarChild/solar_system_level2/haumea.html",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "妊卫二"
    ],
    "color": "#b2baab",
    "en": {
      "name": "Namaka",
      "type": "Moon",
      "fact": "Haumea’s smaller known moon",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the offset shoulder and shallow hollows, compare Hiʻiaka, then return to Haumea.",
      "observation": "Orbit the offset shoulder and shallow hollows, compare Hiʻiaka, then return to Haumea.",
      "story": "Namaka is the smaller of Haumea’s two known moons, named for another of Haumea’s children in Hawaiian mythology. Its detailed surface and outline are unresolved in the source used here; the pale irregular relief is an authored interpretation. Shape, fine geography, colour, illumination, rotation and compressed parent-centred orbit are artistic illustrations, not an acquired mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Continue the comparison within this moon family.",
      "representationNote": "Authored surface and shape; no complete measured terrain map. Orbits and sizes are compressed for exploration."
    },
    "zh": {
      "name": "妊卫二",
      "type": "卫星",
      "fact": "妊神星较小的已知卫星",
      "spaceReference": "太阳系内",
      "invitation": "环视偏斜肩部与浅凹陷，对照妊卫一，再返回妊神星。",
      "observation": "环视偏斜肩部与浅凹陷，对照妊卫一，再返回妊神星。",
      "story": "妊卫二是妊神星两颗已知卫星中较小的一颗，名字来自夏威夷神话中妊神的另一位孩子。所用资料没有解析其精细表面与轮廓；浅色不规则起伏为艺术化解释。形体、精细地貌、色彩、受光、转动与压缩的母体中心轨道为艺术示意，不是取得的任务网格、实测地形或实时星历。",
      "nextReason": "继续比较同一家族的不同成员。",
      "representationNote": "表面与形体为艺术创作，无完整实测地形图；轨道与大小为探索压缩。"
    }
  },
  {
    "key": "mk2",
    "target": "MK 2",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Makemake",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/image-detail/image1-_p1618aw/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "MK2",
      "鸟卫一",
      "S/2015 (136472) 1",
      "S/2015(136472)1"
    ],
    "color": "#38302b",
    "en": {
      "name": "MK 2",
      "type": "Moon",
      "fact": "Makemake’s much fainter companion",
      "spaceReference": "Within the Solar System",
      "invitation": "Examine dark brown relief, withdraw to the orange parent, then return to Makemake.",
      "observation": "Examine dark brown relief, withdraw to the orange parent, then return to Makemake.",
      "story": "Hubble’s moon discovery was announced in 2016. Its provisional designation is S/2015 (136472) 1 and its nickname is MK 2; it is much fainter than Makemake. The image resolves the companion’s presence, not its geography. Its detailed shape, dark material and craters here are artistic hypotheses. Shape, fine geography, colour, illumination, rotation and compressed parent-centred orbit are artistic illustrations, not an acquired mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Continue the comparison within this moon family.",
      "representationNote": "Authored surface and shape; no complete measured terrain map. Orbits and sizes are compressed for exploration."
    },
    "zh": {
      "name": "MK 2",
      "type": "卫星",
      "fact": "鸟神星身边暗得多的小伴侣",
      "spaceReference": "太阳系内",
      "invitation": "近观暗褐色起伏，退离寻找橙色母体，再返回鸟神星。",
      "observation": "近观暗褐色起伏，退离寻找橙色母体，再返回鸟神星。",
      "story": "2016 年公布的哈勃发现为这颗卫星给出临时编号 S/2015 (136472) 1，昵称 MK 2；它比鸟神星暗得多。图像确认伴侣的存在，没有解析其地貌。这里的精细形状、暗色材料与撞击坑为艺术化假设。形体、精细地貌、色彩、受光、转动与压缩的母体中心轨道为艺术示意，不是取得的任务网格、实测地形或实时星历。",
      "nextReason": "继续比较同一家族的不同成员。",
      "representationNote": "表面与形体为艺术创作，无完整实测地形图；轨道与大小为探索压缩。"
    }
  }
,
  {
    "key": "amalthea",
    "target": "Amalthea",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Thebe",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/jupiter/jupiter-moons/amalthea/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "木卫五"
    ],
    "color": "#a33d1a",
    "en": {
      "name": "Amalthea",
      "type": "Moon",
      "fact": "A red, irregular inner moon",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the red shoulders and broad depressions, then compare Thebe.",
      "observation": "Orbit the red shoulders and broad depressions, then compare Thebe.",
      "story": "Galileo revealed an irregular inner moon with craters, hills and valleys. Amalthea has a notably red surface. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "木卫五",
      "type": "卫星",
      "fact": "红色不规则的内侧卫星",
      "spaceReference": "太阳系内",
      "invitation": "环视红色肩部与宽阔凹陷，再比较木卫十四。",
      "observation": "环视红色肩部与宽阔凹陷，再比较木卫十四。",
      "story": "伽利略号揭示了这颗内侧不规则卫星的坑、丘陵与谷地；木卫五的表面明显偏红。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "thebe",
    "target": "Thebe",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Amalthea",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/jupiter/jupiter-moons/thebe/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "木卫十四"
    ],
    "color": "#85573b",
    "en": {
      "name": "Thebe",
      "type": "Moon",
      "fact": "A small moon inside the Galilean system",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow the uneven rim and broad basin; return through Jupiter’s family.",
      "observation": "Follow the uneven rim and broad basin; return through Jupiter’s family.",
      "story": "Thebe is an irregular inner moon of Jupiter, inside the orbits of its four large Galilean moons. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "木卫十四",
      "type": "卫星",
      "fact": "伽利略卫星内侧的小世界",
      "spaceReference": "太阳系内",
      "invitation": "沿不规则轮廓观察宽盆地，再从木星家族返回。",
      "observation": "沿不规则轮廓观察宽盆地，再从木星家族返回。",
      "story": "木卫十四位于木星四颗大型伽利略卫星的轨道内侧，是一个不规则的小世界。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "himalia",
    "target": "Himalia",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Phoebe",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/jupiter/jupiter-moons/himalia/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "木卫六"
    ],
    "color": "#45423d",
    "en": {
      "name": "Himalia",
      "type": "Moon",
      "fact": "An outer moon and a satellite-group namesake",
      "spaceReference": "Within the Solar System",
      "invitation": "Observe subdued charcoal relief and compare Saturn’s outer moon Phoebe.",
      "observation": "Observe subdued charcoal relief and compare Saturn’s outer moon Phoebe.",
      "story": "Himalia is the largest member of a group of outer Jovian moons with similar orbits and appearances. Resolved fine geography is unavailable here. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "木卫六",
      "type": "卫星",
      "fact": "外侧卫星群的代表",
      "spaceReference": "太阳系内",
      "invitation": "观察克制的炭色起伏，再比较土星外侧的土卫九。",
      "observation": "观察克制的炭色起伏，再比较土星外侧的土卫九。",
      "story": "木卫六是木星外侧一组轨道与外观相似卫星中最大的成员；这里没有可用的精细实测地貌。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "janus",
    "target": "Janus",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Epimetheus",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/janus/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "土卫十"
    ],
    "color": "#b0ab96",
    "en": {
      "name": "Janus",
      "type": "Moon",
      "fact": "One of Saturn’s two co-orbital moons",
      "spaceReference": "Within the Solar System",
      "invitation": "Explore cratered shoulders and compare the smaller Epimetheus.",
      "observation": "Explore cratered shoulders and compare the smaller Epimetheus.",
      "story": "Janus is an irregular, cratered moon. It shares very similar orbits with Epimetheus; the real pair exchanges inner and outer orbital positions. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "土卫十",
      "type": "卫星",
      "fact": "土星同轨卫星之一",
      "spaceReference": "太阳系内",
      "invitation": "观察多坑肩部，再比较较小的土卫十一。",
      "observation": "观察多坑肩部，再比较较小的土卫十一。",
      "story": "土卫十是不规则的多坑卫星，与土卫十一共享十分接近的轨道；真实的两颗卫星会交换内外轨道位置。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "epimetheus",
    "target": "Epimetheus",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Janus",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/epimetheus/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "土卫十一"
    ],
    "color": "#a8a391",
    "en": {
      "name": "Epimetheus",
      "type": "Moon",
      "fact": "A co-orbital moon with a flattened southern side",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the flattened side and recessed basins, then compare Janus.",
      "observation": "Orbit the flattened side and recessed basins, then compare Janus.",
      "story": "Epimetheus shares Saturn’s co-orbital arrangement with Janus. Its irregular shape includes a flattened southern region associated with an old large crater. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "土卫十一",
      "type": "卫星",
      "fact": "南侧较扁的同轨卫星",
      "spaceReference": "太阳系内",
      "invitation": "环视较扁的一侧与凹陷盆地，再比较土卫十。",
      "observation": "环视较扁的一侧与凹陷盆地，再比较土卫十。",
      "story": "土卫十一与土卫十共享土星的同轨关系；不规则形体的南侧较扁，与古老大坑有关。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "helene",
    "target": "Helene",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Dione",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/helene/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "土卫十二"
    ],
    "color": "#c4bfb0",
    "en": {
      "name": "Helene",
      "type": "Moon",
      "fact": "Dione’s Trojan companion around Saturn",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow soft troughs across rounded shoulders, then compare Dione.",
      "observation": "Follow soft troughs across rounded shoulders, then compare Dione.",
      "story": "Helene orbits Saturn in the same orbit as Dione, near a stable Lagrange region. It is a small, irregular moon. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "土卫十二",
      "type": "卫星",
      "fact": "与土卫四同轨的特洛伊卫星",
      "spaceReference": "太阳系内",
      "invitation": "沿圆钝肩部观察柔和沟槽，再比较土卫四。",
      "observation": "沿圆钝肩部观察柔和沟槽，再比较土卫四。",
      "story": "土卫十二在稳定的拉格朗日区域附近，与土卫四沿同一轨道绕土星运行，是一颗不规则小卫星。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "telesto",
    "target": "Telesto",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Calypso",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/telesto/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "土卫十三"
    ],
    "color": "#d9d6c9",
    "en": {
      "name": "Telesto",
      "type": "Moon",
      "fact": "Tethys’ smooth leading Trojan",
      "spaceReference": "Within the Solar System",
      "invitation": "Compare broad smooth shoulders with Calypso’s worn hollows.",
      "observation": "Compare broad smooth shoulders with Calypso’s worn hollows.",
      "story": "Telesto leads Tethys in their shared orbit around Saturn. Cassini images show a smooth, icy appearance with little intense cratering. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "土卫十三",
      "type": "卫星",
      "fact": "土卫三前方较平滑的特洛伊卫星",
      "spaceReference": "太阳系内",
      "invitation": "比较宽阔平滑的肩部与土卫十四磨蚀的凹地。",
      "observation": "比较宽阔平滑的肩部与土卫十四磨蚀的凹地。",
      "story": "土卫十三在共同的土星轨道上领先土卫三；卡西尼图像呈现较平滑的冰质外观，强烈撞击坑较少。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "calypso",
    "target": "Calypso",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Telesto",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/calypso/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "土卫十四"
    ],
    "color": "#cfd4cc",
    "en": {
      "name": "Calypso",
      "type": "Moon",
      "fact": "Tethys’ trailing Trojan",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit elongated shoulders and shallow hollows, then revisit Telesto.",
      "observation": "Orbit elongated shoulders and shallow hollows, then revisit Telesto.",
      "story": "Calypso follows Tethys around Saturn. Its irregular outline and softened crater appearance suggest loose surface material. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "土卫十四",
      "type": "卫星",
      "fact": "土卫三后方的特洛伊卫星",
      "spaceReference": "太阳系内",
      "invitation": "环视拉长的肩部与浅凹地，再回访土卫十三。",
      "observation": "环视拉长的肩部与浅凹地，再回访土卫十三。",
      "story": "土卫十四在土星轨道上跟随土卫三；不规则轮廓与较柔和的坑面外观提示松散表面物质。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "prometheus",
    "target": "Prometheus",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Pandora",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/prometheus/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "普罗米修斯",
      "土卫十六"
    ],
    "color": "#c4baa1",
    "en": {
      "name": "Prometheus",
      "type": "Moon",
      "fact": "A shepherd of Saturn’s F ring",
      "spaceReference": "Within the Solar System",
      "invitation": "Follow the elongated body and rounded ends, then compare Pandora.",
      "observation": "Follow the elongated body and rounded ends, then compare Pandora.",
      "story": "Prometheus is an extremely irregular, relatively lightly cratered moon that helps constrain the inner edge of Saturn’s F ring. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "普罗米修斯",
      "type": "卫星",
      "fact": "土星 F 环的牧羊卫星",
      "spaceReference": "太阳系内",
      "invitation": "观察拉长的身躯和圆钝端部，再比较潘多拉。",
      "observation": "观察拉长的身躯和圆钝端部，再比较潘多拉。",
      "story": "普罗米修斯形状十分不规则、撞击坑相对较少；它帮助约束土星 F 环的内侧边缘。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "pandora",
    "target": "Pandora",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Prometheus",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/saturn/moons/pandora/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "潘多拉",
      "土卫十七"
    ],
    "color": "#b8b2a3",
    "en": {
      "name": "Pandora",
      "type": "Moon",
      "fact": "An icy, dust-coated neighbour of the F ring",
      "spaceReference": "Within the Solar System",
      "invitation": "Trace powder-soft hollows and the long groove; compare Prometheus.",
      "observation": "Trace powder-soft hollows and the long groove; compare Prometheus.",
      "story": "Pandora has softened craters beneath fine icy material, with grooves and ridges across its surface. It tends to disturb Saturn’s F ring. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "潘多拉",
      "type": "卫星",
      "fact": "F 环附近覆有冰尘的小卫星",
      "spaceReference": "太阳系内",
      "invitation": "沿覆尘凹地与长沟槽观察，再比较普罗米修斯。",
      "observation": "沿覆尘凹地与长沟槽观察，再比较普罗米修斯。",
      "story": "潘多拉表面细小冰质物质使撞击坑显得柔和，地表有沟槽与脊线；它会扰动土星 F 环。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "galatea",
    "target": "Galatea",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Despina",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/neptune/moons/galatea/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "海卫六"
    ],
    "color": "#545759",
    "en": {
      "name": "Galatea",
      "type": "Moon",
      "fact": "A small moon associated with Neptune’s ring disturbances",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit subdued slate shoulders and return through Neptune’s family.",
      "observation": "Orbit subdued slate shoulders and return through Neptune’s family.",
      "story": "Galatea is a small irregular moon near Neptune’s equatorial plane. Its gravity is believed to disturb the ring system. Detailed surface geography is unavailable here. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "海卫六",
      "type": "卫星",
      "fact": "与海王星环扰动有关的小卫星",
      "spaceReference": "太阳系内",
      "invitation": "环视低亮度灰色肩部，再从海王星家族返回。",
      "observation": "环视低亮度灰色肩部，再从海王星家族返回。",
      "story": "海卫六靠近海王星赤道面，是一颗不规则小卫星，其引力被认为会扰动环系；这里没有精细实测地貌。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "despina",
    "target": "Despina",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Galatea",
    "sourceLabel": "NASA",
    "sourceUrl": "https://science.nasa.gov/neptune/moons/despina/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "海卫五"
    ],
    "color": "#524f4a",
    "en": {
      "name": "Despina",
      "type": "Moon",
      "fact": "An inner moon within Neptune’s faint rings",
      "spaceReference": "Within the Solar System",
      "invitation": "Observe broad dim relief and compare the other ring moon Galatea.",
      "observation": "Observe broad dim relief and compare the other ring moon Galatea.",
      "story": "Despina is a small irregular moon inside Neptune’s faint ring system, moving near the equatorial plane. Detailed surface geography is unavailable here. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "海卫五",
      "type": "卫星",
      "fact": "海王星暗淡环系内的小卫星",
      "spaceReference": "太阳系内",
      "invitation": "观察宽阔暗色起伏，再比较另一颗环系卫星海卫六。",
      "observation": "观察宽阔暗色起伏，再比较另一颗环系卫星海卫六。",
      "story": "海卫五位于海王星暗淡环系之内，是一颗靠近赤道面运行的不规则小卫星；这里没有精细实测地貌。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "kleopatra",
    "target": "Kleopatra",
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "AlexHelios",
    "sourceLabel": "ESO",
    "sourceUrl": "https://www.eso.org/public/news/eso2113/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "克娄巴特拉",
      "216 Kleopatra",
      "Cleopatra",
      "克娄巴特拉星",
      "克莱奥帕特拉"
    ],
    "color": "#7a786e",
    "en": {
      "name": "Kleopatra",
      "type": "Asteroid",
      "fact": "A dog-bone asteroid with two moons",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the long neck, visit both small moons, and return to the shared family view.",
      "observation": "Orbit the long neck, visit both small moons, and return to the shared family view.",
      "story": "ESO observations resolve unequal lobes connected by a neck and two moons, AlexHelios and CleoSelene. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "克娄巴特拉",
      "type": "小行星",
      "fact": "有两颗伴星的狗骨状小行星",
      "spaceReference": "太阳系内",
      "invitation": "环视长颈部，访问两颗小伴星，再返回共同家族视角。",
      "observation": "环视长颈部，访问两颗小伴星，再返回共同家族视角。",
      "story": "ESO 观测辨认出颈部相连的不同大小双叶，以及两颗伴星 AlexHelios 和 CleoSelene。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "alexhelios",
    "target": "AlexHelios",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "CleoSelene",
    "sourceLabel": "ESO",
    "sourceUrl": "https://www.eso.org/public/news/eso2113/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "亚历克斯赫利俄斯"
    ],
    "color": "#737069",
    "en": {
      "name": "AlexHelios",
      "type": "Moon",
      "fact": "A moon of Kleopatra",
      "spaceReference": "Within the Solar System",
      "invitation": "Visit this restrained small world and compare its companion CleoSelene.",
      "observation": "Visit this restrained small world and compare its companion CleoSelene.",
      "story": "AlexHelios is one of the two small moons orbiting Kleopatra. Its fine surface is unresolved here. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "亚历克斯赫利俄斯",
      "type": "卫星",
      "fact": "克娄巴特拉的小伴星",
      "spaceReference": "太阳系内",
      "invitation": "访问这颗克制表现的小世界，再比较另一颗伴星 CleoSelene。",
      "observation": "访问这颗克制表现的小世界，再比较另一颗伴星 CleoSelene。",
      "story": "AlexHelios 是围绕克娄巴特拉的两颗小伴星之一；这里没有已分辨的精细表面。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "cleoselene",
    "target": "CleoSelene",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Kleopatra",
    "sourceLabel": "ESO",
    "sourceUrl": "https://www.eso.org/public/news/eso2113/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "克莱奥塞勒涅"
    ],
    "color": "#6e7375",
    "en": {
      "name": "CleoSelene",
      "type": "Moon",
      "fact": "Another moon of Kleopatra",
      "spaceReference": "Within the Solar System",
      "invitation": "Orbit the small irregular rim, then return to the dog-bone primary.",
      "observation": "Orbit the small irregular rim, then return to the dog-bone primary.",
      "story": "CleoSelene is the other small moon in Kleopatra’s triple system. Its fine surface is unresolved here. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "克莱奥塞勒涅",
      "type": "卫星",
      "fact": "克娄巴特拉的另一颗小伴星",
      "spaceReference": "太阳系内",
      "invitation": "环视小而不规则的轮廓，再返回狗骨状主星。",
      "observation": "环视小而不规则的轮廓，再返回狗骨状主星。",
      "story": "CleoSelene 是克娄巴特拉三天体系统的另一颗小伴星；这里没有已分辨的精细表面。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  },
  {
    "key": "hygiea",
    "target": "Hygiea",
    "bodyKind": "asteroid",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Kleopatra",
    "sourceLabel": "ESO",
    "sourceUrl": "https://www.eso.org/public/news/eso1918/",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "aliases": [
      "健神星",
      "10 Hygiea",
      "Hygieia"
    ],
    "color": "#57595c",
    "en": {
      "name": "Hygiea",
      "type": "Asteroid",
      "fact": "A nearly round main-belt world",
      "spaceReference": "Within the Solar System",
      "invitation": "Compare the broad, quiet round form with elongated Kleopatra.",
      "observation": "Compare the broad, quiet round form with elongated Kleopatra.",
      "story": "ESO’s SPHERE observations revealed a nearly spherical shape without the expected giant impact basin. This catalog retains the asteroid category. The shape, fine geography, colour, light, rotation and orbit are authored illustrations, not a mission mesh, measured terrain or live ephemeris.",
      "nextReason": "Compare a different shape and family member."
    },
    "zh": {
      "name": "健神星",
      "type": "小行星",
      "fact": "近乎圆形的主带世界",
      "spaceReference": "太阳系内",
      "invitation": "比较宽阔平缓的圆形世界与拉长的克娄巴特拉。",
      "observation": "比较宽阔平缓的圆形世界与拉长的克娄巴特拉。",
      "story": "ESO 的 SPHERE 观测揭示近乎球形的形体，没有发现预期的巨大撞击盆地；本目录仍将它归入小行星。 这里的形体、精细地貌、颜色、受光、转动与轨道均为艺术示意，不是任务网格、实测地形或实时星历。",
      "nextReason": "继续对照另一种形体和家族成员。"
    }
  }
];
DESTINATIONS.push(...SMALL_SATELLITE_NOTES.filter(note=>['amalthea','kleopatra'].includes(note.key)));

const SCULPTED_NEBULA_NOTES = [
  {
    "key": "dumbbell-nebula",
    "target": "Dumbbell Nebula",
    "aliases": [
      "M27",
      "Messier 27",
      "NGC6853"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Cat's Eye Nebula",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-27/",
    "color": "#7de8bf",
    "en": {
      "name": "Dumbbell Nebula",
      "type": "Planetary nebula · M27",
      "fact": "Two bright lobes and small gas knots",
      "spaceReference": "In Vulpecula, within the Milky Way",
      "invitation": "Circle the open barrel, approach between its two lobes and inspect the small knots. Withdraw to recover the full outline.",
      "observation": "Circle the open barrel, approach between its two lobes and inspect the small knots. Withdraw to recover the full outline.",
      "story": "M27 is a planetary nebula: gas shed late in a star’s life, rather than a planet. Its two bright lobes give the Dumbbell its name. Hubble resolves dense knots with trails where stellar winds interact with clumps of gas and dust. Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "representationNote": "Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "nextReason": "Compare a broad two-lobed shell with intersecting inner shells."
    },
    "zh": {
      "name": "哑铃星云",
      "type": "行星状星云 · M27",
      "fact": "双侧亮瓣与小气结",
      "spaceReference": "银河系内 · 狐狸座方向",
      "invitation": "环视开放桶状壳，沿两侧亮瓣之间接近小气结；退离后重新辨认完整轮廓。",
      "observation": "环视开放桶状壳，沿两侧亮瓣之间接近小气结；退离后重新辨认完整轮廓。",
      "story": "M27 是恒星晚期释放气体形成的行星状星云，并不是行星；两侧亮瓣带来哑铃般的外观。哈勃在其中分辨出致密气结与尾迹，显示恒星风和气尘团块的相互作用。 气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "representationNote": "气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "nextReason": "比较宽阔双瓣与相互交叠的内层壳。"
    }
  },
  {
    "key": "catseye-nebula",
    "target": "Cat's Eye Nebula",
    "aliases": [
      "NGC6543",
      "C6",
      "Caldwell 6",
      "Cat Eye Nebula"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Dumbbell Nebula",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/missions/hubble/cats-eye-hubble-remix/",
    "color": "#7de3cf",
    "en": {
      "name": "Cat's Eye Nebula",
      "type": "Planetary nebula · NGC 6543",
      "fact": "Complex inner structures and faint outer shells",
      "spaceReference": "In Draco, within the Milky Way",
      "invitation": "Orbit to separate the tilted inner shells from faint outer arcs. Enter the central opening, then withdraw to compare their depth.",
      "observation": "Orbit to separate the tilted inner shells from faint outer arcs. Enter the central opening, then withdraw to compare their depth.",
      "story": "The Cat’s Eye marks a brief late phase of a Sun-like star. Repeated mass loss may explain its concentric outer shells, while the origin of the complex inner structures remains uncertain. The illustration offers intersecting shells to explore, without claiming a measured reconstruction. Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "representationNote": "Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "nextReason": "Compare nested shells with M27’s broad open lobes."
    },
    "zh": {
      "name": "猫眼星云",
      "type": "行星状星云 · NGC 6543",
      "fact": "复杂内层与淡淡的外壳",
      "spaceReference": "银河系内 · 天龙座方向",
      "invitation": "环视让倾斜内壳与淡外弧分开，进入中央开口，再退离比较层间深度。",
      "observation": "环视让倾斜内壳与淡外弧分开，进入中央开口，再退离比较层间深度。",
      "story": "猫眼星云展现类太阳恒星晚期的短暂阶段。反复释放物质可能解释外侧同心壳层，但复杂内层的成因仍不完全清楚。这里用交叠壳层提供探索线索，不宣称实测重建。 气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "representationNote": "气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "nextReason": "对照多层壳与 M27 的宽阔开放亮瓣。"
    }
  },
  {
    "key": "butterfly-nebula",
    "target": "Butterfly Nebula",
    "aliases": [
      "NGC6302",
      "C69",
      "Caldwell 69",
      "Bug Nebula"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Bubble Nebula",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://www.nasa.gov/image-article/butterfly-nebula-2/",
    "color": "#eda65e",
    "en": {
      "name": "Butterfly Nebula",
      "type": "Bipolar planetary nebula · NGC 6302",
      "fact": "Two gas wings around a dusty waist",
      "spaceReference": "In Scorpius, within the Milky Way",
      "invitation": "Orbit the dusty waist to reveal hollow wings at different depths. Enter beside the waist and follow a folded gas wall outward.",
      "observation": "Orbit the dusty waist to reveal hollow wings at different depths. Enter beside the waist and follow a folded gas wall outward.",
      "story": "NGC 6302 surrounds a dying, extremely hot star. A dense dusty torus hides the star from direct view and crosses the bright ionised cavity. Its two extended lobes suggest wings; they are gas structures, not a flat silhouette. Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "representationNote": "Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "nextReason": "Compare bipolar outflow with a wind-blown bubble."
    },
    "zh": {
      "name": "蝴蝶星云",
      "type": "双极行星状星云 · NGC 6302",
      "fact": "暗尘腰带两侧展开气体云翼",
      "spaceReference": "银河系内 · 天蝎座方向",
      "invitation": "环视暗尘腰带，辨认前后展开的空心云翼；从腰带旁进入，沿折叠气壁向外观察。",
      "observation": "环视暗尘腰带，辨认前后展开的空心云翼；从腰带旁进入，沿折叠气壁向外观察。",
      "story": "NGC 6302 环绕一颗极热的衰老恒星。致密尘埃环遮住中央恒星，并横穿明亮的电离空腔；两侧延展的气体瓣像云翼，不是平面剪影。 气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "representationNote": "气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "nextReason": "比较双极展开与恒星风吹出的气泡。"
    }
  },
  {
    "key": "bubble-nebula",
    "target": "Bubble Nebula",
    "aliases": [
      "NGC7635",
      "C11",
      "Caldwell 11"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Rosette Nebula",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/missions/hubble/hubble-sees-a-star-inflating-a-giant-bubble/",
    "color": "#78c9f0",
    "en": {
      "name": "Bubble Nebula",
      "type": "Wind-blown emission nebula · NGC 7635",
      "fact": "An off-centre star meets a dense cloud bank",
      "spaceReference": "In Cassiopeia, within the Milky Way",
      "invitation": "Find the off-centre light, orbit the shell and its dense outer bank, then enter the hollow interior. Withdraw until the shell closes into view again.",
      "observation": "Find the off-centre light, orbit the shell and its dense outer bank, then enter the hollow interior. Withdraw until the shell closes into view again.",
      "story": "A hot massive star’s wind sweeps surrounding gas into the Bubble Nebula’s shell. Denser material on one side makes the star appear off-centre. Dusty pillars and illuminated gas outside the bubble are part of the surrounding nebula too. Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "representationNote": "Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "nextReason": "Compare a compact bubble with a broader star-forming cavity."
    },
    "zh": {
      "name": "气泡星云",
      "type": "恒星风塑造的发射星云 · NGC 7635",
      "fact": "偏心恒星与致密云岸相遇",
      "spaceReference": "银河系内 · 仙后座方向",
      "invitation": "找到偏心亮点，环视气泡壳与外侧云岸，再进入空腔；退离至完整壳层重新进入视野。",
      "observation": "找到偏心亮点，环视气泡壳与外侧云岸，再进入空腔；退离至完整壳层重新进入视野。",
      "story": "炽热大质量恒星的风将周围气体扫成气泡壳，一侧较致密的物质令恒星显得偏离中心。气泡之外的尘柱和受照云气同样属于周围星云。 气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "representationNote": "气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "nextReason": "比较紧凑气泡与更宽阔的恒星诞生空腔。"
    }
  },
  {
    "key": "rosette-nebula",
    "target": "Rosette Nebula",
    "aliases": [
      "NGC2237",
      "Rosette"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Swan Nebula",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/asset/hubble/rosette-nebula-context-image/",
    "color": "#e86e7d",
    "en": {
      "name": "Rosette Nebula",
      "type": "Star-forming nebula complex",
      "fact": "Young stars illuminate gas and dark dusty clouds",
      "spaceReference": "In Monoceros, within the Milky Way",
      "invitation": "Approach through the broken cloud collar, follow a dusty inward finger and orbit to separate foreground clouds from the broad cavity.",
      "observation": "Approach through the broken cloud collar, follow a dusty inward finger and orbit to separate foreground clouds from the broad cavity.",
      "story": "The Rosette is a broad star-forming region at the end of a molecular cloud. Radiation from young stars makes its gas glow, with dusty hydrogen clouds silhouetted against it. This target represents the nebula complex; it is also commonly called NGC 2237, while the central cluster NGC 2244 is a distinct object. Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "representationNote": "Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "nextReason": "Compare a broad cavity with an eroded star-forming ridge."
    },
    "zh": {
      "name": "玫瑰星云",
      "type": "恒星诞生的星云复合体",
      "fact": "年轻恒星照亮气体与暗尘云",
      "spaceReference": "银河系内 · 麒麟座方向",
      "invitation": "从破碎云环之间接近，沿向内伸出的尘柱观察，再环视区分前景云岸与宽阔空腔。",
      "observation": "从破碎云环之间接近，沿向内伸出的尘柱观察，再环视区分前景云岸与宽阔空腔。",
      "story": "玫瑰星云是分子云一端的广阔恒星形成区，年轻恒星的辐射使气体发光，含尘氢云形成暗色剪影。这里观察的是星云复合体；也常以 NGC 2237 称呼它，中央星团 NGC 2244 则是另一个对象。 气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "representationNote": "气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "nextReason": "比较宽阔空腔与被侵蚀的恒星诞生云脊。"
    }
  },
  {
    "key": "veil-nebula",
    "target": "Veil Nebula",
    "aliases": [
      "Cygnus Loop",
      "天鹅座环状星云",
      "面纱"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Crab Nebula",
    "sourceLabel": "ESA / Hubble",
    "sourceUrl": "https://esahubble.org/images/potw2113a/",
    "color": "#6ecfe8",
    "en": {
      "name": "Veil Nebula",
      "type": "Supernova remnant · Cygnus Loop",
      "fact": "Shock waves trace delicate ionised filaments",
      "spaceReference": "In Cygnus, within the Milky Way",
      "invitation": "Follow separate shock ribbons, turn to see them cross at different depths and withdraw to recover the broken outer arcs. There is no invented central star.",
      "observation": "Follow separate shock ribbons, turn to see them cross at different depths and withdraw to recover the broken outer arcs. There is no invented central star.",
      "story": "The Veil is the visible portion of the Cygnus Loop supernova remnant. Shock waves and stellar debris sculpt threads of ionised gas. Hubble resolves only small portions of this large remnant; the sparse three-dimensional arcs here are an authored interpretation of that structure. Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "representationNote": "Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "nextReason": "Compare sparse shock filaments with the Crab’s denser remnant network."
    },
    "zh": {
      "name": "面纱星云",
      "type": "超新星遗迹 · 天鹅座环",
      "fact": "冲击波勾勒细密电离云丝",
      "spaceReference": "银河系内 · 天鹅座方向",
      "invitation": "沿分开的冲击丝带接近，转动视角辨认不同深度的交叉，再退离寻找断续外弧。这里没有虚构的中央恒星。",
      "observation": "沿分开的冲击丝带接近，转动视角辨认不同深度的交叉，再退离寻找断续外弧。这里没有虚构的中央恒星。",
      "story": "面纱星云是天鹅座环超新星遗迹的可见部分，冲击波和恒星碎屑塑造电离气体的纤细云丝。哈勃精细图像只覆盖大型遗迹的小片区域；这里疏散的立体弧丝是对这种结构的艺术表达。 气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "representationNote": "气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "nextReason": "比较疏散冲击云丝与蟹状星云较致密的残骸网络。"
    }
  },
  {
    "key": "flame-nebula",
    "target": "Flame Nebula",
    "aliases": [
      "NGC2024",
      "Flame"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Horsehead Nebula",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/missions/hubble/hubble-spots-swirls-of-dust-in-the-flame-nebula/",
    "color": "#f5a14a",
    "en": {
      "name": "Flame Nebula",
      "type": "Dusty star-forming region · NGC 2024",
      "fact": "Dark dusty branches cross glowing gas",
      "spaceReference": "In Orion, within the Milky Way",
      "invitation": "Enter beside a dark branch, orbit its foreground edge and compare the glowing banks behind it. Withdraw before following the Horsehead’s simpler silhouette.",
      "observation": "Enter beside a dark branch, orbit its foreground edge and compare the glowing banks behind it. Withdraw before following the Horsehead’s simpler silhouette.",
      "story": "The Flame belongs to the Orion Molecular Cloud Complex. Much of its young star cluster is hidden by dust. Nearby Alnitak ionises hydrogen; light emitted as that gas loses energy illuminates the dust from behind. The illustrated branches are spatial landmarks, not mapped dust measurements. Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "representationNote": "Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "nextReason": "Compare a branching dust lane with a compact dust silhouette."
    },
    "zh": {
      "name": "火焰星云",
      "type": "含尘恒星形成区 · NGC 2024",
      "fact": "暗尘分支横穿发光气体",
      "spaceReference": "银河系内 · 猎户座方向",
      "invitation": "沿暗尘分支旁进入，环视前景边缘与后方发光云岸；退离后再比较马头星云较集中的剪影。",
      "observation": "沿暗尘分支旁进入，环视前景边缘与后方发光云岸；退离后再比较马头星云较集中的剪影。",
      "story": "火焰星云属于猎户座分子云复合体，年轻星团大多藏在尘埃之后。附近参宿一使氢电离；气体回到较低能态时发光，从后方映出尘云。示意中的暗尘分支提供空间线索，不是尘埃测量地图。 气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "representationNote": "气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "nextReason": "比较分叉暗尘通道与集中的尘云剪影。"
    }
  },
  {
    "key": "swan-nebula",
    "target": "Swan Nebula",
    "aliases": [
      "M17",
      "Messier 17",
      "NGC6618",
      "Omega Nebula",
      "欧米伽星云"
    ],
    "bodyKind": "nebula",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Eagle Nebula",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-17/",
    "color": "#f5bf82",
    "en": {
      "name": "Swan Nebula",
      "type": "Stellar nursery · M17",
      "fact": "Young stars erode dense cloud ridges",
      "spaceReference": "In Sagittarius, within the Milky Way",
      "invitation": "Approach over the scalloped ridge, look back along its illuminated front and orbit the cavity to reveal the colder bank behind.",
      "observation": "Approach over the scalloped ridge, look back along its illuminated front and orbit the cavity to reveal the colder bank behind.",
      "story": "M17, also called the Omega Nebula, is a large Milky Way star-forming region. Young stars irradiate and erode cold clouds, leaving dense pockets and dark projections. Telescope images use selected wavelengths; this scene’s sculpted ridge, cavity and colours are an illustration rather than a literal bird or a measured reconstruction. Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "representationNote": "Gas, dust, embedded lights, colour, activity, position and compressed scale are procedural illustrations, not telescope pixels or measured three-dimensional structure.",
      "nextReason": "Compare an eroded ridge with the Eagle’s dark pillars."
    },
    "zh": {
      "name": "天鹅星云",
      "type": "恒星诞生的云 · M17",
      "fact": "年轻恒星侵蚀致密云脊",
      "spaceReference": "银河系内 · 人马座方向",
      "invitation": "沿起伏云脊上方接近，顺受照前缘回望，再环视空腔辨认后方较冷的云岸。",
      "observation": "沿起伏云脊上方接近，顺受照前缘回望，再环视空腔辨认后方较冷的云岸。",
      "story": "M17 又称欧米伽星云，是银河系中的大型恒星形成区。年轻恒星辐射并侵蚀冷云，留下致密气团和向内突出的暗色结构。望远镜图像使用选定波段；这里的云脊、空腔和色彩是示意，不是字面的鸟形或实测重建。 气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "representationNote": "气体、暗尘、嵌入亮点、颜色、活动、位置与压缩尺度均为程序示意，并非望远镜图像或实测三维结构。",
      "nextReason": "比较受侵蚀的云脊与鹰状星云的暗尘柱。"
    }
  }
];
DESTINATIONS.push(...SCULPTED_NEBULA_NOTES.filter(note=>['butterfly-nebula','bubble-nebula'].includes(note.key)));

const GALAXY_PORTRAIT_NOTES = [
  {
    "key": "whirlpool-galaxy",
    "target": "Whirlpool Galaxy",
    "aliases": [
      "M51",
      "NGC5194",
      "Messier 51"
    ],
    "bodyKind": "galaxy",
    "spaceRegion": "outside-milky-way",
    "spaceSource": "body",
    "nextTarget": "NGC 1300",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-51/",
    "color": "#8cbdff",
    "en": {
      "name": "Whirlpool Galaxy",
      "type": "Grand-design spiral · M51",
      "fact": "Two prominent arms rich in stellar nurseries",
      "spaceReference": "Toward Canes Venatici",
      "invitation": "Follow a blue arm past its dark inner lane, enter the local starlight, then withdraw to recover both arms.",
      "observation": "Follow a blue arm past its dark inner lane, enter the local starlight, then withdraw to recover both arms.",
      "story": "M51 has prominent curved arms with blue star clusters, pink star-forming regions and dust. Its encounter with the small galaxy NGC 5195 may help accentuate those arms. The companion is not represented as a separate object here. The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "representationNote": "The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "nextReason": "Compare a different galactic structure, then revisit this view."
    },
    "zh": {
      "name": "涡状星系",
      "type": "大设计旋涡星系 · M51",
      "fact": "两条醒目的旋臂，嵌着恒星诞生区域",
      "spaceReference": "猎犬座方向",
      "invitation": "沿蓝色旋臂追踪内侧暗尘，进入局部星光，再退离辨认两条旋臂。",
      "observation": "沿蓝色旋臂追踪内侧暗尘，进入局部星光，再退离辨认两条旋臂。",
      "story": "M51 的醒目旋臂中有蓝色星团、粉色恒星形成区域和暗尘。与小星系 NGC 5195 的近距离相遇可能强化了这些旋臂；这里尚未将伴星系作为独立天体表现。 三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "representationNote": "三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "nextReason": "对照另一种星系结构，再回访当前视角。"
    }
  },
  {
    "key": "barred-galaxy",
    "target": "NGC 1300",
    "aliases": [
      "NGC1300",
      "Barred Spiral NGC 1300"
    ],
    "bodyKind": "galaxy",
    "spaceRegion": "outside-milky-way",
    "spaceSource": "body",
    "nextTarget": "Whirlpool Galaxy",
    "sourceLabel": "ESA / Hubble",
    "sourceUrl": "https://esahubble.org/images/opo0501a/",
    "color": "#a3bfff",
    "en": {
      "name": "NGC 1300",
      "type": "Barred spiral galaxy",
      "fact": "Arms begin at the ends of a stellar bar",
      "spaceReference": "Toward Eridanus",
      "invitation": "Find the elongated central bar and follow an arm outward. Orbit to separate the thin disc from the bar’s local stars.",
      "observation": "Find the elongated central bar and follow an arm outward. Orbit to separate the thin disc from the bar’s local stars.",
      "story": "NGC 1300 is a barred spiral. Its arms connect to the ends of a straight bar of stars rather than continuing directly to the centre. Dust and glowing gas trace its structure. The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "representationNote": "The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "nextReason": "Compare a different galactic structure, then revisit this view."
    },
    "zh": {
      "name": "NGC 1300 星系",
      "type": "棒旋星系",
      "fact": "旋臂从恒星棒的两端伸出",
      "spaceReference": "波江座方向",
      "invitation": "先辨认延长的中央恒星棒，再沿一条旋臂向外观察。环视让薄盘与棒内星光分出层次。",
      "observation": "先辨认延长的中央恒星棒，再沿一条旋臂向外观察。环视让薄盘与棒内星光分出层次。",
      "story": "NGC 1300 是棒旋星系，旋臂连接中央恒星棒的两端，而不是直接旋入中心。暗尘与发光气体勾勒出它的结构。 三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "representationNote": "三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "nextReason": "对照另一种星系结构，再回访当前视角。"
    }
  },
  {
    "key": "sombrero-galaxy",
    "target": "Sombrero Galaxy",
    "aliases": [
      "M104",
      "NGC4594",
      "Sombrero",
      "Messier 104"
    ],
    "bodyKind": "galaxy",
    "spaceRegion": "outside-milky-way",
    "spaceSource": "body",
    "nextTarget": "Needle Galaxy",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-104/",
    "color": "#ffd199",
    "en": {
      "name": "Sombrero Galaxy",
      "type": "Nearly edge-on spiral · M104",
      "fact": "A bright bulge encircled by a thick dust lane",
      "spaceReference": "Toward Virgo",
      "invitation": "Start at the dark brim, orbit above it to reveal the dust ring, then approach the warm central starlight.",
      "observation": "Start at the dark brim, orbit above it to reveal the dust ring, then approach the warm central starlight.",
      "story": "M104 is seen nearly edge-on from Earth. Its bright central bulge is encircled by thick dust lanes, and it has a rich population of globular clusters. The local lights shown here are illustrative stars, not identified globular clusters. The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "representationNote": "The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "nextReason": "Compare a different galactic structure, then revisit this view."
    },
    "zh": {
      "name": "草帽星系",
      "type": "近侧视旋涡星系 · M104",
      "fact": "明亮隆起被厚重暗尘带环绕",
      "spaceReference": "室女座方向",
      "invitation": "从暗色帽檐开始，环视到上方辨认尘环，再接近暖色中央星光。",
      "observation": "从暗色帽檐开始，环视到上方辨认尘环，再接近暖色中央星光。",
      "story": "从地球看 M104 接近侧视，明亮的中央隆起被厚重暗尘带围绕，并拥有丰富的球状星团。这里的局部亮点是示意星光，并非已辨认的球状星团。 三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "representationNote": "三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "nextReason": "对照另一种星系结构，再回访当前视角。"
    }
  },
  {
    "key": "centaurusa-galaxy",
    "target": "Centaurus A",
    "aliases": [
      "NGC5128",
      "C77",
      "Caldwell 77",
      "Cen A"
    ],
    "bodyKind": "galaxy",
    "spaceRegion": "outside-milky-way",
    "spaceSource": "body",
    "nextTarget": "Messier 49",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/asset/hubble/hubble-finds-twisted-gas-disk-from-galaxy-collision-fueling-nearst-active-black-hole/",
    "color": "#ffc280",
    "en": {
      "name": "Centaurus A",
      "type": "Peculiar elliptical · NGC 5128",
      "fact": "A broad dust belt cuts through an elliptical glow",
      "spaceReference": "Toward Centaurus",
      "invitation": "Trace the warped dark belt through the warm ellipsoid. Change sides to see foreground dust hide more distant stars.",
      "observation": "Trace the warped dark belt through the warm ellipsoid. Change sides to see foreground dust hide more distant stars.",
      "story": "Centaurus A is an active, peculiar elliptical galaxy with a dramatic dust disc. The disc is thought to be a remnant of a smaller galaxy involved in a collision. This view concentrates on starlight and dust; it does not depict the radio lobes or resolve the central black hole. The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "representationNote": "The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "nextReason": "Compare a different galactic structure, then revisit this view."
    },
    "zh": {
      "name": "半人马座 A",
      "type": "特殊椭圆星系 · NGC 5128",
      "fact": "宽阔尘带横贯椭球星光",
      "spaceReference": "半人马座方向",
      "invitation": "沿翘曲暗带穿过暖色椭球，换到另一侧观察前景尘埃如何遮住远处星光。",
      "observation": "沿翘曲暗带穿过暖色椭球，换到另一侧观察前景尘埃如何遮住远处星光。",
      "story": "半人马座 A 是活跃的特殊椭圆星系，拥有醒目的尘盘；这可能是参与碰撞的较小星系留下的结构。这里着重表现星光与暗尘，尚未表现射电瓣，也没有分辨中央黑洞。 三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "representationNote": "三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "nextReason": "对照另一种星系结构，再回访当前视角。"
    }
  },
  {
    "key": "cigar-galaxy",
    "target": "Cigar Galaxy",
    "aliases": [
      "M82",
      "NGC3034",
      "Cigar",
      "Messier 82"
    ],
    "bodyKind": "galaxy",
    "spaceRegion": "outside-milky-way",
    "spaceSource": "body",
    "nextTarget": "Centaurus A",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-82/",
    "color": "#ff8f78",
    "en": {
      "name": "Cigar Galaxy",
      "type": "Starburst galaxy · M82",
      "fact": "Intense star formation drives a galactic wind",
      "spaceReference": "Toward Ursa Major",
      "invitation": "Look across the broken dusty core and orbit toward the paired outflow above and below the disc. Approach the embedded lights, then back out.",
      "observation": "Look across the broken dusty core and orbit toward the paired outflow above and below the disc. Approach the embedded lights, then back out.",
      "story": "M82 is a starburst galaxy interacting with M81. Young stars and sculpted dust fill its centre, and energetic newborn stars drive a galactic wind. The outflow here is a slow artistic interpretation, not an observed speed or a physical simulation. The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "representationNote": "The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "nextReason": "Compare a different galactic structure, then revisit this view."
    },
    "zh": {
      "name": "雪茄星系",
      "type": "星暴星系 · M82",
      "fact": "密集恒星诞生活动驱动星系风",
      "spaceReference": "大熊座方向",
      "invitation": "横看破碎暗尘中的核心，环视盘面上下的双向外流；接近嵌入星光后再退离。",
      "observation": "横看破碎暗尘中的核心，环视盘面上下的双向外流；接近嵌入星光后再退离。",
      "story": "M82 是与 M81 相互作用的星暴星系，中央充满年轻恒星和复杂暗尘，新生恒星的能量驱动星系风。这里放慢的外流是艺术化表达，并非实测速度或物理模拟。 三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "representationNote": "三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "nextReason": "对照另一种星系结构，再回访当前视角。"
    }
  },
  {
    "key": "needle-galaxy",
    "target": "Needle Galaxy",
    "aliases": [
      "NGC4565",
      "C38",
      "Caldwell 38",
      "Needle"
    ],
    "bodyKind": "galaxy",
    "spaceRegion": "outside-milky-way",
    "spaceSource": "body",
    "nextTarget": "Sombrero Galaxy",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-38/",
    "color": "#ffcf99",
    "en": {
      "name": "Needle Galaxy",
      "type": "Edge-on spiral · NGC 4565",
      "fact": "Dust ribbons obscure a very thin galactic disc",
      "spaceReference": "Toward Coma Berenices",
      "invitation": "Use the long dust seam as a reference while approaching. Orbit above the seam and withdraw to regain its needle-like silhouette.",
      "observation": "Use the long dust seam as a reference while approaching. Orbit above the seam and withdraw to regain its needle-like silhouette.",
      "story": "NGC 4565 is a spiral galaxy viewed edge-on from Earth, also called the Needle. Ribbons of dust obscure light in its disc and near its core. Orbiting here reveals an authored disc, not a measured hidden face-on view. The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "representationNote": "The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "nextReason": "Compare a different galactic structure, then revisit this view."
    },
    "zh": {
      "name": "针状星系",
      "type": "侧视旋涡星系 · NGC 4565",
      "fact": "暗尘丝带遮住纤薄星系盘",
      "spaceReference": "后发座方向",
      "invitation": "接近时以细长暗缝作空间参照，环视到暗缝上方，再退离恢复针状轮廓。",
      "observation": "接近时以细长暗缝作空间参照，环视到暗缝上方，再退离恢复针状轮廓。",
      "story": "NGC 4565 是从地球侧视的旋涡星系，也称针状星系。暗尘丝带遮住盘面及核心附近的星光。这里环视后显露的盘面是程序设计，并非对隐藏正面的实测重建。 三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "representationNote": "三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "nextReason": "对照另一种星系结构，再回访当前视角。"
    }
  },
  {
    "key": "elliptical-galaxy",
    "target": "Messier 49",
    "aliases": [
      "M49",
      "NGC4472",
      "Messier49"
    ],
    "bodyKind": "galaxy",
    "spaceRegion": "outside-milky-way",
    "spaceSource": "body",
    "nextTarget": "Centaurus A",
    "sourceLabel": "NASA / Hubble",
    "sourceUrl": "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-49/",
    "color": "#ffd199",
    "en": {
      "name": "Messier 49",
      "type": "Giant elliptical galaxy · M49",
      "fact": "A smooth stellar ellipsoid with an older population",
      "spaceReference": "Toward Virgo",
      "invitation": "Approach from the diffuse outskirts into warm local starlight. Orbit to read the ellipsoid, then compare it with a dusty active galaxy.",
      "observation": "Approach from the diffuse outskirts into warm local starlight. Orbit to read the ellipsoid, then compare it with a dusty active galaxy.",
      "story": "M49 is a giant elliptical galaxy in the Virgo Cluster. Elliptical galaxies have relatively little large-scale structure compared with spirals, and their stars are usually older. This deliberately quieter object has no invented spiral arms or star-forming gas lanes. The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "representationNote": "The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "nextReason": "Compare a different galactic structure, then revisit this view."
    },
    "zh": {
      "name": "梅西耶 49",
      "type": "巨型椭圆星系 · M49",
      "fact": "由较老恒星群构成的平滑椭球",
      "spaceReference": "室女座方向",
      "invitation": "从弥散外围进入暖色局部星光，环视辨认椭球，再与活跃的含尘星系对照。",
      "observation": "从弥散外围进入暖色局部星光，环视辨认椭球，再与活跃的含尘星系对照。",
      "story": "M49 是室女座星系团中的巨型椭圆星系。与旋涡星系相比，椭圆星系的大尺度结构较少，恒星通常更老。这里保留较安静的椭球形态，没有额外虚构旋臂或恒星形成气体通道。 三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "representationNote": "三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "nextReason": "对照另一种星系结构，再回访当前视角。"
    }
  },
  {
    "key": "cartwheel-galaxy",
    "target": "Cartwheel Galaxy",
    "aliases": [
      "Cartwheel",
      "ESO350-40",
      "ESO 350-40",
      "车轮"
    ],
    "bodyKind": "galaxy",
    "spaceRegion": "outside-milky-way",
    "spaceSource": "body",
    "nextTarget": "Whirlpool Galaxy",
    "sourceLabel": "NASA / Webb",
    "sourceUrl": "https://science.nasa.gov/missions/webb/webb-captures-stellar-gymnastics-in-the-cartwheel-galaxy/",
    "color": "#8fbdff",
    "en": {
      "name": "Cartwheel Galaxy",
      "type": "Collisional ring galaxy",
      "fact": "Two rings joined by faint spoke-like structure",
      "spaceReference": "Toward Sculptor",
      "invitation": "Follow the broken blue outer ring, cross the fainter spokes and approach the inner ring. Withdraw to reconnect the two scales.",
      "observation": "Follow the broken blue outer ring, cross the fainter spokes and approach the inner ring. Withdraw to reconnect the two scales.",
      "story": "A high-speed galactic collision reshaped the Cartwheel into an inner and an outer ring. The outer ring is rich in star formation, with spoke-like features between the rings. The collision itself and neighbouring galaxies are not animated or reconstructed here. The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "representationNote": "The three-dimensional structure, local lights, colour, motion, placement and compressed scale are procedural artistic illustrations, not telescope pixels, a measured stellar catalogue or a reconstruction of hidden features.",
      "nextReason": "Compare a different galactic structure, then revisit this view."
    },
    "zh": {
      "name": "车轮星系",
      "type": "碰撞环状星系",
      "fact": "两道环之间延伸着较淡的辐条结构",
      "spaceReference": "玉夫座方向",
      "invitation": "沿破碎蓝色外环追踪较淡辐条，接近内环，再退离重新连接两种尺度。",
      "observation": "沿破碎蓝色外环追踪较淡辐条，接近内环，再退离重新连接两种尺度。",
      "story": "高速星系碰撞把车轮星系重塑成内外两道环，外环中有丰富的恒星形成活动，两环之间存在辐条状结构。这里没有重演碰撞过程，也没有重建周围伴星系。 三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "representationNote": "三维结构、局部亮点、颜色、活动、位置与压缩尺度均为程序艺术示意，并非望远镜图像、实测恒星目录或隐藏结构的重建。",
      "nextReason": "对照另一种星系结构，再回访当前视角。"
    }
  }
];
DESTINATIONS.push(...GALAXY_PORTRAIT_NOTES.filter(note=>['barred-galaxy','cartwheel-galaxy'].includes(note.key)));

const FRONTIER_BINARY_NOTES = [
  {
    "key": "orcus",
    "target": "Orcus",
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Vanth",
    "aliases": [
      "90482 Orcus",
      "亡神星"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/1108.5963",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#778992",
    "en": {
      "name": "Orcus",
      "type": "Trans-Neptunian world · dwarf-planet candidate",
      "fact": "Crystalline water ice in the spectrum",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Follow the pale plain into its shallow rim, then withdraw to Vanth.",
      "observation": "Follow the pale plain into its shallow rim, then withdraw to Vanth.",
      "story": "Spectroscopy identifies crystalline water ice on Orcus. Vanth is a distinct companion; the observations do not provide a resolved terrain map. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "亡神星",
      "type": "海王星外天体 · 矮行星候选",
      "fact": "光谱中的结晶水冰",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "沿浅色平原观察宽缓边缘，再退回共同空间拜访 Vanth。",
      "observation": "沿浅色平原观察宽缓边缘，再退回共同空间拜访 Vanth。",
      "story": "光谱在亡神星上辨认出结晶水冰。Vanth 是独立的伴侣；这些观测没有提供已解析地形图。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "vanth",
    "target": "Vanth",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Gonggong",
    "aliases": [
      "90482 Orcus I",
      "Orcus I"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/0910.4784",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#472f1f",
    "en": {
      "name": "Vanth",
      "type": "Moon",
      "fact": "A companion with different visible colours",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Orbit the warm basin and pitted shoulders; compare them with Orcus’s pale plain.",
      "observation": "Orbit the warm basin and pitted shoulders; compare them with Orcus’s pale plain.",
      "story": "Observations of the Orcus–Vanth system constrain a mutual orbit and show different visible colours. This warm terrain is an illustration, not a measured composition or map. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "Vanth",
      "type": "卫星",
      "fact": "可见光色彩不同的伴侣",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "环视暖色盆地与起伏肩部，对照亡神星的浅色平原。",
      "observation": "环视暖色盆地与起伏肩部，对照亡神星的浅色平原。",
      "story": "亡神星—Vanth 系统的观测约束了相互轨道，并显示不同的可见光色彩。这里的暖色地貌是示意，不是测得的成分或地图。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "gonggong",
    "target": "Gonggong",
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Xiangliu",
    "aliases": [
      "225088 Gonggong",
      "2007 OR10",
      "共工"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/1903.05439",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#712e1a",
    "en": {
      "name": "Gonggong",
      "type": "Trans-Neptunian world · dwarf-planet candidate",
      "fact": "A distant world weighed through its moon",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Follow the copper-coloured regions across the wide hollow, then find tiny Xiangliu.",
      "observation": "Follow the copper-coloured regions across the wide hollow, then find tiny Xiangliu.",
      "story": "The satellite orbit constrains Gonggong’s mass and density. Its unresolved surface is represented with authored broad copper-coloured regions and restrained relief. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "共工",
      "type": "海王星外天体 · 矮行星候选",
      "fact": "借助卫星称量的遥远世界",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "沿铜色区域观察宽凹地，再寻找小小的相柳。",
      "observation": "沿铜色区域观察宽凹地，再寻找小小的相柳。",
      "story": "卫星轨道帮助约束共工的质量与密度。未解析的表面在这里以宽阔的铜色区域与克制的起伏表达。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "xiangliu",
    "target": "Xiangliu",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Salacia",
    "aliases": [
      "Gonggong I",
      "225088 Gonggong I",
      "相柳"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/1903.05439",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#211f21",
    "en": {
      "name": "Xiangliu",
      "type": "Moon",
      "fact": "A small moon reveals its parent’s mass",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Approach the dark bowl, sweep around the uneven limb, then return to Gonggong.",
      "observation": "Approach the dark bowl, sweep around the uneven limb, then return to Gonggong.",
      "story": "Hubble observations constrain the companion’s orbit. They resolve the companion’s presence, not its detailed geography; its grey shoulders and hollows are authored. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "相柳",
      "type": "卫星",
      "fact": "用小卫星追踪母体质量",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "接近暗色盆地，绕过不平整的边缘，再返回共工。",
      "observation": "接近暗色盆地，绕过不平整的边缘，再返回共工。",
      "story": "哈勃观测约束了这颗伴侣的轨道，确认了它的存在，而没有解析精细地貌；灰色肩部与凹陷为作者创作。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "salacia",
    "target": "Salacia",
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Actaea",
    "aliases": [
      "120347 Salacia"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/2508.17101",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#35414a",
    "en": {
      "name": "Salacia",
      "type": "Trans-Neptunian world · dwarf-planet candidate",
      "fact": "Water and carbon dioxide ice in combined light",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Observe the broad cool-toned plain and its boundary, then visit Actaea.",
      "observation": "Observe the broad cool-toned plain and its boundary, then visit Actaea.",
      "story": "JWST spectroscopy of the blended Salacia–Actaea system detects water and carbon dioxide ice. The combined spectrum does not locate ice patches or assign them separately to either world. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "Salacia",
      "type": "海王星外天体 · 矮行星候选",
      "fact": "合并光谱中的水冰与二氧化碳冰",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "观察冷色宽平原与边界，再拜访 Actaea。",
      "observation": "观察冷色宽平原与边界，再拜访 Actaea。",
      "story": "JWST 对 Salacia—Actaea 系统的合并光谱探测到水冰与二氧化碳冰；它不能定位冰区，也不能把这些成分分别归给某一个天体。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "actaea",
    "target": "Actaea",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Varda",
    "aliases": [
      "Salacia I",
      "120347 Salacia I"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/2509.02734",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#434f53",
    "en": {
      "name": "Actaea",
      "type": "Moon",
      "fact": "A paired system studied through changing light",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Follow the narrow groove over the basin wall and compare the larger parent.",
      "observation": "Follow the narrow groove over the basin wall and compare the larger parent.",
      "story": "Long-term photometry supports a synchronous configuration for the Salacia–Actaea system. Displayed motion is compressed and illustrative; it does not reproduce the measured period or a live orbit. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "Actaea",
      "type": "卫星",
      "fact": "从明暗变化研究双天体系统",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "沿窄沟越过盆地边缘，再与更大的母体比较。",
      "observation": "沿窄沟越过盆地边缘，再与更大的母体比较。",
      "story": "长期测光研究支持 Salacia—Actaea 系统的同步构型。显示的运动经过压缩，是示意表达，不重现测得周期或实时轨道。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "varda",
    "target": "Varda",
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Ilmarë",
    "aliases": [
      "174567 Varda"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/1505.00510",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#5f6458",
    "en": {
      "name": "Varda",
      "type": "Trans-Neptunian world · dwarf-planet candidate",
      "fact": "A binary with a well-constrained mutual orbit",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Sweep across the flattened pale world, follow the broad hollow and visit Ilmarë.",
      "observation": "Sweep across the flattened pale world, follow the broad hollow and visit Ilmarë.",
      "story": "Hubble, Keck and Gemini observations constrain Varda and Ilmarë’s mutual orbit. Similar colours do not supply resolved geography; the oblate shape and pale regions here are artistic hypotheses. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "Varda",
      "type": "海王星外天体 · 矮行星候选",
      "fact": "相互轨道得到约束的双天体",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "环视扁平的浅色天体，沿宽凹地接近并拜访 Ilmarë。",
      "observation": "环视扁平的浅色天体，沿宽凹地接近并拜访 Ilmarë。",
      "story": "哈勃、凯克与双子座的观测约束了 Varda 与 Ilmarë 的相互轨道。相近的色彩没有提供已解析地貌；这里的扁球形体与浅色区域为艺术假设。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "ilmare",
    "target": "Ilmarë",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Varuna",
    "aliases": [
      "Ilmare",
      "Varda I",
      "174567 Varda I"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/1505.00510",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#58615f",
    "en": {
      "name": "Ilmarë",
      "type": "Moon",
      "fact": "The second world in Varda’s binary",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Compare the pale basin and worn shoulders with Varda, then continue to Varuna.",
      "observation": "Compare the pale basin and worn shoulders with Varda, then continue to Varuna.",
      "story": "The mutual-orbit study finds broadly similar colours for the two components, with uncertain physical properties. No resolved surface map is available in this source. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "Ilmarë",
      "type": "卫星",
      "fact": "Varda 双天体系统的另一成员",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "对照 Varda，观察浅色盆地与磨蚀肩部，再前往 Varuna。",
      "observation": "对照 Varda，观察浅色盆地与磨蚀肩部，再前往 Varuna。",
      "story": "相互轨道研究显示两个成员的大致色彩相近，物理性质仍有不确定性。所用来源没有提供已解析的表面地图。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "varuna",
    "target": "Varuna",
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Ixion",
    "aliases": [
      "20000 Varuna"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/astro-ph/0201082",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#5b331e",
    "en": {
      "name": "Varuna",
      "type": "Trans-Neptunian world · dwarf-planet candidate",
      "fact": "A light curve suggests an elongated world",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Orbit the elongated silhouette; follow the ochre basin and the seam across its long shoulder.",
      "observation": "Orbit the elongated silhouette; follow the ochre basin and the seam across its long shoulder.",
      "story": "A large double-peaked rotational light curve supports an elongated-shape interpretation. The displayed proportions, surface markings and rotation are illustrative, not a resolved shape reconstruction. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "Varuna",
      "type": "海王星外天体 · 矮行星候选",
      "fact": "明暗变化暗示细长形体",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "环视细长轮廓，沿赭色盆地与沟缝观察延伸的肩部。",
      "observation": "环视细长轮廓，沿赭色盆地与沟缝观察延伸的肩部。",
      "story": "振幅较大的双峰自转光变曲线支持细长形体的解释。这里的比例、表面斑纹与转动为示意，不是已解析的形状重建。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "ixion",
    "target": "Ixion",
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "2002 MS4",
    "aliases": [
      "28978 Ixion"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://www.aanda.org/articles/aa/full/2009/01/aa10561-08/aa10561-08.right.html",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#633c26",
    "en": {
      "name": "Ixion",
      "type": "Trans-Neptunian world · dwarf-planet candidate",
      "fact": "Distant colours leave the geography open",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Trace the copper boundary around a shallow basin, then compare 2002 MS4’s broad hollow.",
      "observation": "Trace the copper boundary around a shallow basin, then compare 2002 MS4’s broad hollow.",
      "story": "Visible and near-infrared photometry studies Ixion’s colours. Colour classification is not a terrain map; the contrasting ochre regions and shallow basins here are authored. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "Ixion",
      "type": "海王星外天体 · 矮行星候选",
      "fact": "遥远的色彩线索留下地貌悬念",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "沿铜色边界观察浅盆地，再对照 2002 MS4 的宽凹地。",
      "observation": "沿铜色边界观察浅盆地，再对照 2002 MS4 的宽凹地。",
      "story": "可见光与近红外测光研究了 Ixion 的色彩。色彩分类不是地形图；这里对比明显的赭色区域与浅盆地为作者创作。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "weywot",
    "target": "Weywot",
    "bodyKind": "moon",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Quaoar",
    "aliases": [
      "Quaoar I",
      "50000 Quaoar I"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/2511.07351",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#2d271f",
    "en": {
      "name": "Weywot",
      "type": "Moon",
      "fact": "A moon tests more than point-mass gravity",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Orbit the dark basin, withdraw until Quaoar’s rings reappear and return to the parent.",
      "observation": "Orbit the dark basin, withdraw until Quaoar’s rings reappear and return to the parent.",
      "story": "A recent orbital analysis uses non-spherical gravity to describe Weywot’s motion. This visualization uses an authored parent-centred orbit, not that fitted dynamical solution. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "Weywot",
      "type": "卫星",
      "fact": "用卫星检验点质量之外的引力",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "环视暗色盆地，退离寻找夸瓦尔的环，再返回母体。",
      "observation": "环视暗色盆地，退离寻找夸瓦尔的环，再返回母体。",
      "story": "较新的轨道分析用非球形引力描述 Weywot 的运动。这里采用作者设计的母体中心示意轨道，不是该研究拟合的动力学解。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  },
  {
    "key": "ms4",
    "target": "2002 MS4",
    "bodyKind": "dwarfplanet",
    "spaceRegion": "solar-system",
    "spaceSource": "body",
    "nextTarget": "Quaoar",
    "aliases": [
      "307261",
      "307261 2002 MS4",
      "2002 MS₄"
    ],
    "sourceLabel": "Research paper",
    "sourceUrl": "https://arxiv.org/abs/2308.08062",
    "mapSourceLabel": "程序示意 · Procedural illustration",
    "color": "#464c51",
    "en": {
      "name": "2002 MS4",
      "type": "Trans-Neptunian world · dwarf-planet candidate",
      "fact": "Occultations reveal an uneven limb",
      "spaceReference": "Beyond Neptune · Solar System",
      "invitation": "Move around the wide basin to see its sloping wall change light, then compare ringed Quaoar.",
      "observation": "Move around the wide basin to see its sloping wall change light, then compare ringed Quaoar.",
      "story": "Multiple stellar occultations reveal departures from an elliptical limb, including a large crater-like depression. They constrain limited limb profiles, not a complete surface; this broad basin’s location and form are authored. Fine geography, colours, proportions, lighting and motion are authored illustrations, not measured terrain or live ephemerides.",
      "nextReason": "Continue through the distant worlds and their companions.",
      "representationNote": "Authored shape and terrain; no complete resolved surface map. Sizes, spacing and motion are compressed for exploration."
    },
    "zh": {
      "name": "2002 MS4",
      "type": "海王星外天体 · 矮行星候选",
      "fact": "掩星揭示不平整边缘",
      "spaceReference": "海王星外 · 太阳系",
      "invitation": "绕过宽盆地，观察坡壁受光变化，再对照带环的夸瓦尔。",
      "observation": "绕过宽盆地，观察坡壁受光变化，再对照带环的夸瓦尔。",
      "story": "多次恒星掩星揭示了偏离椭圆的轮廓，包括大型坑状凹陷。它们约束局部边缘剖面，不能给出完整表面；这里宽盆地的位置与形态由作者设计。精细地貌、色彩、比例、受光与运动为作者示意，不是实测地形或实时星历。",
      "nextReason": "继续探索遥远世界与它们的伴侣。",
      "representationNote": "形体与地貌为作者创作，无完整已解析表面图；大小、间距与运动为探索压缩。"
    }
  }
];
DESTINATIONS.push(...FRONTIER_BINARY_NOTES.filter(note=>['orcus','gonggong','varuna','ms4'].includes(note.key)));

const COMPACT_REMNANT_NOTES = [
  {
    "key": "b1509",
    "target": "PSR B1509-58",
    "aliases": [
      "宇宙之手脉冲星",
      "B1509",
      "PSR J1513-5908"
    ],
    "bodyKind": "pulsar",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Crab Pulsar",
    "color": "#82d9c6",
    "sourceLabel": "NASA / CXC · Chandra",
    "sourceUrl": "https://chandra.harvard.edu/photo/2009/b1509/",
    "en": {
      "type": "Young neutron star · Wind and jet illustration",
      "fact": "A pulsar powers the nebula nicknamed the Cosmic Hand",
      "spaceReference": "Inside the pulsar wind nebula MSH 15-52",
      "invitation": "Follow a narrow jet through a faint inner wind.",
      "story": "Chandra reveals a young, energetic pulsar and a surrounding wind nebula. An inner ring and a jet carry clues to the outflow; the much larger nebula resembles a hand. This view focuses on the compact centre, not the entire hand-shaped cloud. Thermal caps, magnetic curves, wind arcs, colours, spacing and slow motion are authored procedural illustrations, not a measured surface, pulse timing or an X-ray reconstruction.",
      "observation": "Read the jet and faint wind arcs first, then approach the smooth green-blue thermal layers around the hot caps. Orbit to separate the rotating magnetic beams from the wind jet along the spin axis.",
      "nextReason": "Compare the inner wind with the Crab’s outward-moving wisps.",
      "name": "PSR B1509-58",
      "representationNote": "Structure, colour, scale and slowed activity are authored illustrations, not observed surface or measured motion."
    },
    "zh": {
      "type": "年轻中子星 · 风区与喷流示意",
      "fact": "为“宇宙之手”星云供能的脉冲星",
      "spaceReference": "MSH 15-52 脉冲星风星云的内部",
      "invitation": "沿着狭窄喷流，穿过淡薄的内侧风区。",
      "story": "钱德拉观测显示一颗年轻、能量充沛的脉冲星及周围的风星云；内侧环状结构与喷流提供了外流的线索，更大尺度的星云像一只手。这里聚焦致密中心，没有重建整片手形云。热区、磁场曲线、风弧、颜色、间距与放慢的活动均为作者创作的程序示意，不是实测表面、脉冲计时或 X 射线重建。",
      "observation": "先辨认喷流与淡薄风弧，再靠近热极周围平滑的青绿色热层。环视并区分跟随热极扫动的磁极辐射束与沿自转轴延伸的风区喷流。",
      "nextReason": "对照蟹状脉冲星向外传播的风纹。",
      "name": "PSR B1509-58",
      "representationNote": "结构、颜色、尺度与放慢的活动为作者示意，并非观测表面或测量运动。"
    }
  },
  {
    "key": "geminga",
    "target": "Geminga",
    "aliases": [
      "杰明加",
      "PSR J0633+1746",
      "PSR B0633+17"
    ],
    "bodyKind": "pulsar",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Vela Pulsar",
    "color": "#dfb27d",
    "sourceLabel": "NASA / CXC · Chandra",
    "sourceUrl": "https://www.nasa.gov/image-article/chandra-images-show-that-geometry-solves-pulsar-puzzle/",
    "en": {
      "type": "Gamma-ray pulsar · Trailing-structure illustration",
      "fact": "A radio-faint pulsar with long X-ray structures",
      "spaceReference": "A nearby neutron star in the Milky Way",
      "invitation": "Find the two long structures around a small warm core.",
      "story": "Geminga is a gamma-ray pulsar with long structures seen in X-rays. One interpretation of Chandra observations relates the side structures to jets from the spin poles viewed in projection. Their geometry is still an interpretation. The two compressed trails, thermal fronts, magnetic curves, colours and slowed activity here are artistic illustrations, not a reconstructed image, measured surface or a prediction of radio pulses.",
      "observation": "Trace the two swept-back structures, then approach the smooth amber thermal layers and narrow hot caps. Orbit to separate the rotating magnetic beams from the blue wind structures; pause to compare their geometry.",
      "nextReason": "Compare Geminga’s trailing structures with Vela’s curved jet and double arcs.",
      "name": "Geminga",
      "representationNote": "Structure, colour, scale and slowed activity are authored illustrations, not observed surface or measured motion."
    },
    "zh": {
      "type": "伽马射线脉冲星 · 尾状结构示意",
      "fact": "射电辐射较弱 · 具有延展 X 射线结构",
      "spaceReference": "银河系内的一颗近邻中子星",
      "invitation": "在小巧的暖色核心周围，寻找两道延展结构。",
      "story": "杰明加是一颗伽马射线脉冲星，X 射线观测显示长条结构。对钱德拉观测的一种解释将两侧结构与从自转极延伸、经过投影的喷流联系起来，其几何关系仍属解释。这里压缩的双尾、热流、磁场曲线、颜色与放慢的活动是艺术化示意，不是观测图重建、实测表面或射电脉冲预报。",
      "observation": "沿两道后掠结构靠近平滑的琥珀色热层与狭窄热极。环视并区分转动的磁极扫束与蓝色风区结构，暂停后比较它们的空间关系。",
      "nextReason": "比较杰明加的尾状结构与船帆座的弯曲喷流、双弧。",
      "name": "杰明加",
      "representationNote": "结构、颜色、尺度与放慢的活动为作者示意，并非观测表面或测量运动。"
    }
  },
  {
    "key": "cygnus-x1",
    "target": "Cygnus X-1",
    "aliases": [
      "天鹅座 X-1",
      "天鹅座X1",
      "Cyg X-1"
    ],
    "bodyKind": "blackhole",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "MAXI J1820+070",
    "color": "#b0cce9",
    "sourceLabel": "NASA · IXPE",
    "sourceUrl": "https://www.nasa.gov/universe/nasas-ixpe-reveals-shape-orientation-of-hot-matter-around-black-hole/",
    "en": {
      "type": "Stellar-mass black hole · Binary accretion illustration",
      "fact": "An X-ray binary fed by a massive companion star",
      "spaceReference": "Cygnus, inside the Milky Way",
      "invitation": "Follow pale hot streams into the central shadow.",
      "story": "Cygnus X-1 contains a stellar-mass black hole that accretes material supplied by a massive companion. IXPE observations probe the geometry of the hot matter around it. This compressed view centres on the black hole; the donor star is outside the displayed near scene. The bright blue-white disk, shadow, bent light, thermal colours, scale and slowed flow are authored illustrations, not measured disk detail, an optical photograph or a relativistic calculation.",
      "observation": "Approach the pale disk streams and darker spiral channels, then orbit through the edge and face of the disk. The shadow is the only opaque centre; the surrounding light is outside it.",
      "nextReason": "Compare a persistent X-ray binary with the outburst-inspired jets of MAXI J1820+070.",
      "name": "Cygnus X-1",
      "representationNote": "Structure, colour, scale and slowed activity are authored illustrations, not observed surface or measured motion."
    },
    "zh": {
      "type": "恒星质量黑洞 · 双星吸积示意",
      "fact": "由大质量伴星供给物质的 X 射线双星",
      "spaceReference": "银河系内，天鹅座方向",
      "invitation": "沿着淡色热流，接近中央暗影。",
      "story": "天鹅座 X-1 包含一颗恒星质量黑洞，从大质量伴星获得吸积物质。IXPE 观测研究了其周围热物质的几何结构。这里的压缩视图以黑洞为中心，供给物质的伴星位于所显示近景之外。明亮蓝白盘面、暗影、弯曲光路、温度色彩、尺度与放慢的流动是作者创作的示意，不是实测盘面细节、可见光照片或相对论计算。",
      "observation": "靠近淡色盘面流束与深色螺旋通道，环视盘面的侧缘和正面。只有中央暗影提供不透明遮挡，周围的光来自它之外。",
      "nextReason": "对照持续的 X 射线双星与受历史爆发启发的 MAXI 喷流。",
      "name": "天鹅座 X-1",
      "representationNote": "结构、颜色、尺度与放慢的活动为作者示意，并非观测表面或测量运动。"
    }
  },
  {
    "key": "maxi-j1820",
    "target": "MAXI J1820+070",
    "aliases": [
      "MAXI黑洞",
      "MAXI J1820",
      "ASASSN-18ey"
    ],
    "bodyKind": "blackhole",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "M87*",
    "color": "#e1c39f",
    "sourceLabel": "NASA / CXC · Chandra",
    "sourceUrl": "https://www.chandra.harvard.edu/photo/2020/maxij1820/",
    "en": {
      "type": "Stellar-mass black hole · Historical outburst inspiration",
      "fact": "Chandra followed jets after the 2018 outburst",
      "spaceReference": "An X-ray binary inside the Milky Way",
      "invitation": "Find two opposing jets above and below a warm disk.",
      "story": "Chandra followed material ejected by the stellar-mass black hole MAXI J1820+070 after its 2018 outburst. The observed jet structures expand far beyond the compact binary. This scene draws on that historical outflow, not a current outburst. The disk, dark shadow, bent light, compressed bipolar jets, moving knots, colours and slowed activity are artistic procedural illustrations, not measured positions, an observation replay or a relativistic simulation.",
      "observation": "Read the two opposing jets from the whole view. Approach the disk’s broad streams and fine braided fronts, then orbit to compare the jet axis with the tilted disk.",
      "nextReason": "Compare the compressed bipolar outflow with M87’s much larger jet system.",
      "name": "MAXI J1820+070",
      "representationNote": "Structure, colour, scale and slowed activity are authored illustrations, not observed surface or measured motion."
    },
    "zh": {
      "type": "恒星质量黑洞 · 历史爆发启发的示意",
      "fact": "钱德拉追踪了 2018 年爆发后的喷流",
      "spaceReference": "银河系内的一组 X 射线双星",
      "invitation": "寻找暖色盘面上下两道相向延伸的喷流。",
      "story": "钱德拉追踪了恒星质量黑洞 MAXI J1820+070 在 2018 年爆发后抛出的物质，实际喷流延伸到紧致双星之外很远。场景取材于这次历史外流，并非表示它正在爆发。盘面、暗影、弯曲光路、压缩双极喷流、活动亮结、颜色与放慢的活动均为程序生成的艺术示意，不是测量位置、观测重放或相对论模拟。",
      "observation": "整体先看两道相向喷流，再靠近盘面宽流束与细密弯曲热层。环视喷流轴与倾斜盘面的关系。",
      "nextReason": "对照压缩的双极外流与 M87 更大尺度的喷流系统。",
      "name": "MAXI J1820+070",
      "representationNote": "结构、颜色、尺度与放慢的活动为作者示意，并非观测表面或测量运动。"
    }
  },
  {
    "key": "procyon-b",
    "target": "Procyon B",
    "aliases": [
      "南河三 B",
      "南河三B",
      "Alpha Canis Minoris B"
    ],
    "bodyKind": "star",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Procyon",
    "color": "#e5d6b4",
    "sourceLabel": "Bond et al. · Hubble astrometry",
    "sourceUrl": "https://arxiv.org/abs/1510.00485",
    "en": {
      "type": "White dwarf · Companion to Procyon",
      "fact": "A faint, compact companion measured with Hubble",
      "spaceReference": "The Procyon binary in the Milky Way",
      "invitation": "Meet the small remnant beside Procyon.",
      "story": "Procyon B is the faint white-dwarf companion of Procyon A. Hubble astrometry constrains the binary orbit and masses. Its warm pale thermal layers, glow, relative size, spacing and parent-centred motion here are authored procedural illustrations, not a measured surface, temperature map, true scale or a barycentric ephemeris.",
      "observation": "Approach the broad ivory thermal layers and finer curved fronts, then return to the shared view to compare the compact companion with Procyon.",
      "nextReason": "Return to the larger main star and their shared space.",
      "name": "Procyon B",
      "representationNote": "Structure, colour, scale and slowed activity are authored illustrations, not observed surface or measured motion."
    },
    "zh": {
      "type": "白矮星 · 南河三的伴星",
      "fact": "由哈勃测量的一颗暗弱、致密伴星",
      "spaceReference": "银河系内，南河三双星系统",
      "invitation": "认识南河三身旁的小巧残骸。",
      "story": "南河三 B 是南河三 A 的暗弱白矮星伴星；哈勃天体测量约束了双星的轨道与质量。这里暖淡色热层、光晕、相对大小、间距及围绕主星的运动是作者创作的程序示意，不是实测表面、温度图、真实比例或质心星历。",
      "observation": "靠近象牙色宽热层与更细的弯曲热边界，再返回共同视角，对照小巧伴星与南河三。",
      "nextReason": "返回更大的主星及它们的共同空间。",
      "name": "南河三 B",
      "representationNote": "结构、颜色、尺度与放慢的活动为作者示意，并非观测表面或测量运动。"
    }
  },
  {
    "key": "van-maanen",
    "target": "van Maanen's Star",
    "aliases": [
      "范马南星",
      "van Maanen 2",
      "vMa 2"
    ],
    "bodyKind": "star",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Sirius B",
    "color": "#d7b88e",
    "sourceLabel": "NASA / JPL",
    "sourceUrl": "https://www.jpl.nasa.gov/news/overlooked-treasure-the-first-evidence-of-exoplanets/",
    "en": {
      "type": "Nearby white dwarf · Isolated remnant",
      "fact": "A historic spectrum revealed atmospheric heavy elements",
      "spaceReference": "A nearby white dwarf in the Milky Way",
      "invitation": "Explore a quieter warm remnant without a bright companion.",
      "story": "Van Maanen’s Star is a nearby white dwarf. Heavy elements in its historic spectrum are now understood in the context of material polluting white-dwarf atmospheres, with planetary debris providing indirect evidence. No planet or debris disk is depicted as an observed object here. Warm thermal fronts, colour, glow, size, location and slow activity are artistic illustrations, not a measured surface or temperature map.",
      "observation": "Approach the broad amber-ivory thermal regions and their curved boundaries. Orbit the isolated sphere, then compare the cooler-looking authored palette with Sirius B.",
      "nextReason": "Compare two pale thermal remnants, then explore Sirius B’s binary setting.",
      "name": "van Maanen's Star",
      "representationNote": "Structure, colour, scale and slowed activity are authored illustrations, not observed surface or measured motion."
    },
    "zh": {
      "type": "近邻白矮星 · 独立残骸",
      "fact": "历史光谱揭示了大气中的重元素",
      "spaceReference": "银河系内的一颗近邻白矮星",
      "invitation": "探索没有明亮伴星相随的暖色残骸。",
      "story": "范马南星是一颗近邻白矮星。其历史光谱中的重元素如今被放在白矮星大气受外来物质污染的背景下理解，行星碎屑提供的是间接证据。这里没有把行星或碎屑盘画成已观测的独立天体。暖色热边界、颜色、光晕、大小、位置与缓慢活动均为艺术化示意，不是实测表面或温度图。",
      "observation": "靠近琥珀象牙色的宽热区及弯曲边界，环视独立球面，再对照天狼星 B 的作者设计色彩。",
      "nextReason": "比较两种淡色热层，再探索天狼星 B 的双星环境。",
      "name": "范马南星",
      "representationNote": "结构、颜色、尺度与放慢的活动为作者示意，并非观测表面或测量运动。"
    }
  },
  {
    "key": "procyon",
    "target": "Procyon",
    "bodyKind": "star",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Procyon B",
    "color": "#eee1c5",
    "sourceLabel": "Bond et al. · Hubble astrometry",
    "sourceUrl": "https://arxiv.org/abs/1510.00485",
    "en": {
      "name": "Procyon",
      "type": "Binary main star",
      "fact": "Procyon A has a faint white-dwarf companion",
      "spaceReference": "The Procyon binary in the Milky Way",
      "invitation": "Discover a small stellar remnant beside the bright main star.",
      "story": "Procyon A and the white dwarf Procyon B form a binary system studied with Hubble astrometry. Surface, colours, relative sizes, compressed spacing and parent-centred motion here are artistic illustrations, not surface measurements, true scale or a barycentric ephemeris.",
      "observation": "Observe the warm main star, then open the shared view or visit Procyon B. Return to compare their very different sizes and thermal structure.",
      "nextReason": "Approach the small white-dwarf companion."
    },
    "zh": {
      "name": "南河三",
      "type": "双星系统的主星",
      "fact": "南河三 A 拥有暗弱的白矮星伴星",
      "spaceReference": "银河系内，南河三双星系统",
      "invitation": "在明亮主星身旁，发现一颗小巧的恒星残骸。",
      "story": "南河三 A 与白矮星南河三 B 组成双星系统，哈勃天体测量研究了它们的轨道。表面、颜色、相对大小、压缩间距与围绕主星的运动是艺术化示意，不是实测表面、真实比例或质心星历。",
      "observation": "观察暖色主星后，打开共同视角或前往南河三 B；返回比较两者不同的大小与热层结构。",
      "nextReason": "靠近小巧的白矮星伴星。"
    }
  }
];
DESTINATIONS.push(...COMPACT_REMNANT_NOTES.filter(note=>['b1509','cygnus-x1'].includes(note.key)));

const EXOPLANET_NOTES = [
  {
    "key": "proxima-b",
    "target": "Proxima Centauri b",
    "aliases": [
      "Proxima b",
      "比邻星b"
    ],
    "bodyKind": "planet",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "TRAPPIST-1 e",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/",
    "en": {
      "name": "Proxima Centauri b",
      "type": "Red-dwarf planet",
      "fact": "Radial-velocity discovery · 2016",
      "spaceReference": "Around Proxima Centauri, beyond the Solar System",
      "invitation": "A rocky possibility beneath red starlight.",
      "story": "Radial-velocity measurements reveal a planet orbiting Proxima Centauri in about eleven days. Its actual surface is unresolved. The fractured ochre landscape here is one invented view, not evidence for rock exposure, oceans or life.",
      "observation": "Follow dark basins and branching terrain to the terminator; then visit the host and recover their shared space.",
      "nextReason": "Compare worlds under two different red dwarfs.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "比邻星 b",
      "type": "红矮星旁的系外行星",
      "fact": "2016 年由径向速度发现",
      "spaceReference": "太阳系外 · 围绕比邻星",
      "invitation": "在红色星光下，想象另一颗岩质世界。",
      "story": "径向速度测量揭示了约十一天绕比邻星一周的行星，真实表面尚未分辨。这里的赭色盆地与裂纹是一种虚构外观，不代表已发现裸露岩石、海洋或生命。",
      "observation": "沿盆地与分支地貌接近明暗边界，再拜访主星、回到共同空间。",
      "nextReason": "比较两颗不同红矮星身边的世界。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "trappist-host",
    "target": "TRAPPIST-1",
    "aliases": [
      "2MASS J23062928-0502285",
      "特拉比斯特1"
    ],
    "bodyKind": "star",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "TRAPPIST-1 b",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Webb",
    "sourceUrl": "https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-is-webb-revealing-about-the-trappist-1-system/",
    "en": {
      "name": "TRAPPIST-1",
      "type": "Cool M-type host star",
      "fact": "A compact family of seven known planets",
      "spaceReference": "Milky Way · TRAPPIST-1 planetary system",
      "invitation": "Meet the small star at the centre of seven worlds.",
      "story": "Seven known planets orbit this cool M-type star. Their transit signals reveal a compact planetary family; they do not reveal detailed surface landscapes. The red thermal layers and compressed family layout here are artistic.",
      "observation": "Open the shared family view, choose an inner or outer planet and return to this star.",
      "nextReason": "Begin with the innermost known member.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "TRAPPIST-1",
      "type": "较冷的 M 型主星",
      "fact": "七颗已知行星组成的紧凑家族",
      "spaceReference": "银河系内 · TRAPPIST-1 行星系统",
      "invitation": "先认识七个世界共同环绕的小恒星。",
      "story": "七颗已知行星围绕这颗较冷的 M 型恒星运行。凌星信号揭示了紧凑家族，并没有给出详细的表面景观；这里的红色热层与压缩家族布局是艺术化表达。",
      "observation": "展开共同家族，从内侧或外侧选择行星，再回到主星。",
      "nextReason": "先拜访最内侧的已知成员。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "trappist-b",
    "target": "TRAPPIST-1 b",
    "aliases": [
      "TRAPPIST1b",
      "特拉比斯特1b"
    ],
    "bodyKind": "planet",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "TRAPPIST-1 c",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/trappist-1-b/",
    "en": {
      "name": "TRAPPIST-1 b",
      "type": "Innermost known planet",
      "fact": "A hot inner orbit · About 1.5 days",
      "spaceReference": "Around TRAPPIST-1, beyond the Solar System",
      "invitation": "Dark basins and copper ridges.",
      "story": "TRAPPIST-1 b is a transit-detected planet around the cool M-type star TRAPPIST-1. The terrain shown here is invented. No mapped rock, frost, ocean, surface colour or cloud pattern is claimed; a habitable-zone label would not establish water or life.",
      "observation": "Approach the broad regions and finer seams, orbit across the day-night boundary, then use the shared family view to choose another world.",
      "nextReason": "Move through the family and compare the next planet under the same host light.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "TRAPPIST-1 b",
      "type": "最内侧的已知行星",
      "fact": "内侧近轨道 · 公转约 1.5 天",
      "spaceReference": "太阳系外 · 围绕 TRAPPIST-1",
      "invitation": "暗色盆地与铜色山脊。",
      "story": "TRAPPIST-1 b 是通过凌星发现、围绕较冷 M 型恒星 TRAPPIST-1 的行星。这里的地貌完全由作者设计，不宣称已测绘岩石、冰霜、海洋、表面色彩或云纹；处于宜居带也不能证明水或生命存在。",
      "observation": "靠近宽阔色区与细缝，环视明暗边界，再从共同家族选择另一颗行星。",
      "nextReason": "沿着家族互访，比较同一主星照亮的下一个世界。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "trappist-c",
    "target": "TRAPPIST-1 c",
    "aliases": [
      "TRAPPIST1c",
      "特拉比斯特1c"
    ],
    "bodyKind": "planet",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "TRAPPIST-1 d",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/trappist-1-c/",
    "en": {
      "name": "TRAPPIST-1 c",
      "type": "Second known planet",
      "fact": "A neighbouring inner world",
      "spaceReference": "Around TRAPPIST-1, beyond the Solar System",
      "invitation": "Muted stone and fractured plains.",
      "story": "TRAPPIST-1 c is a transit-detected planet around the cool M-type star TRAPPIST-1. The terrain shown here is invented. No mapped rock, frost, ocean, surface colour or cloud pattern is claimed; a habitable-zone label would not establish water or life.",
      "observation": "Approach the broad regions and finer seams, orbit across the day-night boundary, then use the shared family view to choose another world.",
      "nextReason": "Move through the family and compare the next planet under the same host light.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "TRAPPIST-1 c",
      "type": "第二颗已知行星",
      "fact": "相邻的内侧世界",
      "spaceReference": "太阳系外 · 围绕 TRAPPIST-1",
      "invitation": "暗淡岩色与破碎平原。",
      "story": "TRAPPIST-1 c 是通过凌星发现、围绕较冷 M 型恒星 TRAPPIST-1 的行星。这里的地貌完全由作者设计，不宣称已测绘岩石、冰霜、海洋、表面色彩或云纹；处于宜居带也不能证明水或生命存在。",
      "observation": "靠近宽阔色区与细缝，环视明暗边界，再从共同家族选择另一颗行星。",
      "nextReason": "沿着家族互访，比较同一主星照亮的下一个世界。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "trappist-d",
    "target": "TRAPPIST-1 d",
    "aliases": [
      "TRAPPIST1d",
      "特拉比斯特1d"
    ],
    "bodyKind": "planet",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "TRAPPIST-1 e",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/trappist-1-d/",
    "en": {
      "name": "TRAPPIST-1 d",
      "type": "Third known planet",
      "fact": "Smaller than Earth · About four days",
      "spaceReference": "Around TRAPPIST-1, beyond the Solar System",
      "invitation": "Ochre highlands and deep basins.",
      "story": "TRAPPIST-1 d is a transit-detected planet around the cool M-type star TRAPPIST-1. It is smaller than Earth. The terrain shown here is invented. No mapped rock, frost, ocean, surface colour or cloud pattern is claimed; a habitable-zone label would not establish water or life.",
      "observation": "Approach the broad regions and finer seams, orbit across the day-night boundary, then use the shared family view to choose another world.",
      "nextReason": "Move through the family and compare the next planet under the same host light.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "TRAPPIST-1 d",
      "type": "第三颗已知行星",
      "fact": "比地球小 · 公转约四天",
      "spaceReference": "太阳系外 · 围绕 TRAPPIST-1",
      "invitation": "赭色高地与深色盆地。",
      "story": "TRAPPIST-1 d 是通过凌星发现、围绕较冷 M 型恒星 TRAPPIST-1 的行星。它比地球小。这里的地貌完全由作者设计，不宣称已测绘岩石、冰霜、海洋、表面色彩或云纹；处于宜居带也不能证明水或生命存在。",
      "observation": "靠近宽阔色区与细缝，环视明暗边界，再从共同家族选择另一颗行星。",
      "nextReason": "沿着家族互访，比较同一主星照亮的下一个世界。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "trappist-e",
    "target": "TRAPPIST-1 e",
    "aliases": [
      "TRAPPIST1e",
      "特拉比斯特1e"
    ],
    "bodyKind": "planet",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "TRAPPIST-1 f",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/trappist-1-e/",
    "en": {
      "name": "TRAPPIST-1 e",
      "type": "Terrestrial exoplanet",
      "fact": "Transit discovery · About 6.1 days",
      "spaceReference": "Around TRAPPIST-1, beyond the Solar System",
      "invitation": "Slate-coloured terrain beneath warm light.",
      "story": "TRAPPIST-1 e is a transit-detected planet around the cool M-type star TRAPPIST-1. The terrain shown here is invented. No mapped rock, frost, ocean, surface colour or cloud pattern is claimed; a habitable-zone label would not establish water or life.",
      "observation": "Approach the broad regions and finer seams, orbit across the day-night boundary, then use the shared family view to choose another world.",
      "nextReason": "Move through the family and compare the next planet under the same host light.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "TRAPPIST-1 e",
      "type": "类地系外行星",
      "fact": "凌星发现 · 公转约 6.1 天",
      "spaceReference": "太阳系外 · 围绕 TRAPPIST-1",
      "invitation": "暖光下的灰青地貌。",
      "story": "TRAPPIST-1 e 是通过凌星发现、围绕较冷 M 型恒星 TRAPPIST-1 的行星。这里的地貌完全由作者设计，不宣称已测绘岩石、冰霜、海洋、表面色彩或云纹；处于宜居带也不能证明水或生命存在。",
      "observation": "靠近宽阔色区与细缝，环视明暗边界，再从共同家族选择另一颗行星。",
      "nextReason": "沿着家族互访，比较同一主星照亮的下一个世界。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "trappist-f",
    "target": "TRAPPIST-1 f",
    "aliases": [
      "TRAPPIST1f",
      "特拉比斯特1f"
    ],
    "bodyKind": "planet",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "TRAPPIST-1 g",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/trappist-1-f/",
    "en": {
      "name": "TRAPPIST-1 f",
      "type": "Outer member",
      "fact": "One of seven compactly spaced worlds",
      "spaceReference": "Around TRAPPIST-1, beyond the Solar System",
      "invitation": "An invented frosted landscape.",
      "story": "TRAPPIST-1 f is a transit-detected planet around the cool M-type star TRAPPIST-1. The terrain shown here is invented. No mapped rock, frost, ocean, surface colour or cloud pattern is claimed; a habitable-zone label would not establish water or life.",
      "observation": "Approach the broad regions and finer seams, orbit across the day-night boundary, then use the shared family view to choose another world.",
      "nextReason": "Move through the family and compare the next planet under the same host light.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "TRAPPIST-1 f",
      "type": "外侧成员",
      "fact": "七个紧凑排列的世界之一",
      "spaceReference": "太阳系外 · 围绕 TRAPPIST-1",
      "invitation": "一种虚构的霜覆景观。",
      "story": "TRAPPIST-1 f 是通过凌星发现、围绕较冷 M 型恒星 TRAPPIST-1 的行星。这里的地貌完全由作者设计，不宣称已测绘岩石、冰霜、海洋、表面色彩或云纹；处于宜居带也不能证明水或生命存在。",
      "observation": "靠近宽阔色区与细缝，环视明暗边界，再从共同家族选择另一颗行星。",
      "nextReason": "沿着家族互访，比较同一主星照亮的下一个世界。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "trappist-g",
    "target": "TRAPPIST-1 g",
    "aliases": [
      "TRAPPIST1g",
      "特拉比斯特1g"
    ],
    "bodyKind": "planet",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "TRAPPIST-1 h",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/trappist-1-g/",
    "en": {
      "name": "TRAPPIST-1 g",
      "type": "Outer member",
      "fact": "A larger outer neighbour",
      "spaceReference": "Around TRAPPIST-1, beyond the Solar System",
      "invitation": "Pale plateaus and dark seams.",
      "story": "TRAPPIST-1 g is a transit-detected planet around the cool M-type star TRAPPIST-1. The terrain shown here is invented. No mapped rock, frost, ocean, surface colour or cloud pattern is claimed; a habitable-zone label would not establish water or life.",
      "observation": "Approach the broad regions and finer seams, orbit across the day-night boundary, then use the shared family view to choose another world.",
      "nextReason": "Move through the family and compare the next planet under the same host light.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "TRAPPIST-1 g",
      "type": "外侧成员",
      "fact": "较大的外侧邻居",
      "spaceReference": "太阳系外 · 围绕 TRAPPIST-1",
      "invitation": "淡色台地与暗缝。",
      "story": "TRAPPIST-1 g 是通过凌星发现、围绕较冷 M 型恒星 TRAPPIST-1 的行星。这里的地貌完全由作者设计，不宣称已测绘岩石、冰霜、海洋、表面色彩或云纹；处于宜居带也不能证明水或生命存在。",
      "observation": "靠近宽阔色区与细缝，环视明暗边界，再从共同家族选择另一颗行星。",
      "nextReason": "沿着家族互访，比较同一主星照亮的下一个世界。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "trappist-h",
    "target": "TRAPPIST-1 h",
    "aliases": [
      "TRAPPIST1h",
      "特拉比斯特1h"
    ],
    "bodyKind": "planet",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "TRAPPIST-1 b",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/trappist-1-h/",
    "en": {
      "name": "TRAPPIST-1 h",
      "type": "Outermost known planet",
      "fact": "Smaller than Earth · About 18.8 days",
      "spaceReference": "Around TRAPPIST-1, beyond the Solar System",
      "invitation": "Blue-grey frost and worn basins.",
      "story": "TRAPPIST-1 h is a transit-detected planet around the cool M-type star TRAPPIST-1. It is smaller than Earth. The terrain shown here is invented. No mapped rock, frost, ocean, surface colour or cloud pattern is claimed; a habitable-zone label would not establish water or life.",
      "observation": "Approach the broad regions and finer seams, orbit across the day-night boundary, then use the shared family view to choose another world.",
      "nextReason": "Move through the family and compare the next planet under the same host light.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "TRAPPIST-1 h",
      "type": "最外侧的已知行星",
      "fact": "比地球小 · 公转约 18.8 天",
      "spaceReference": "太阳系外 · 围绕 TRAPPIST-1",
      "invitation": "灰蓝霜区与磨蚀盆地。",
      "story": "TRAPPIST-1 h 是通过凌星发现、围绕较冷 M 型恒星 TRAPPIST-1 的行星。它比地球小。这里的地貌完全由作者设计，不宣称已测绘岩石、冰霜、海洋、表面色彩或云纹；处于宜居带也不能证明水或生命存在。",
      "observation": "靠近宽阔色区与细缝，环视明暗边界，再从共同家族选择另一颗行星。",
      "nextReason": "沿着家族互访，比较同一主星照亮的下一个世界。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "pegasi-host",
    "target": "51 Pegasi",
    "aliases": [
      "51 Peg",
      "飞马座51"
    ],
    "bodyKind": "star",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "51 Pegasi b",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/51-pegasi-b/",
    "en": {
      "name": "51 Pegasi",
      "type": "G-type host star",
      "fact": "Host of the planet announced in 1995",
      "spaceReference": "Milky Way · In the direction of Pegasus",
      "invitation": "A Sun-like host with a very different neighbour.",
      "story": "A gas giant was discovered around this G-type star through radial velocity in 1995. The warm stellar layers and compressed distance here are illustrations.",
      "observation": "Visit the giant planet, then return to their shared space to compare star and planet.",
      "nextReason": "Meet the close-orbiting gas giant.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "飞马座 51",
      "type": "G 型主星",
      "fact": "1995 年公布发现的行星的主星",
      "spaceReference": "银河系内 · 飞马座方向",
      "invitation": "类太阳主星旁，有一个很不同的邻居。",
      "story": "1995 年，径向速度观测揭示这颗 G 型恒星旁的气态巨行星。这里的暖色热层与压缩间距为示意。",
      "observation": "前往气态行星，再回到共同空间比较恒星与行星。",
      "nextReason": "拜访近距离绕行的气态巨行星。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  },
  {
    "key": "pegasi-b",
    "target": "51 Pegasi b",
    "aliases": [
      "51 Peg b",
      "Dimidium",
      "飞马座51b"
    ],
    "bodyKind": "planet",
    "spaceRegion": "milky-way",
    "spaceSource": "body",
    "nextTarget": "Jupiter",
    "color": "#ce9a71",
    "sourceLabel": "NASA · Exoplanet Catalog",
    "sourceUrl": "https://science.nasa.gov/exoplanet-catalog/51-pegasi-b/",
    "en": {
      "name": "51 Pegasi b",
      "type": "Hot gas giant",
      "fact": "Radial-velocity discovery · 1995 · About 4.2 days",
      "spaceReference": "Around 51 Pegasi, beyond the Solar System",
      "invitation": "Follow amber cloud currents near another Sun.",
      "story": "This gas giant completes an orbit around its G-type host in about 4.2 days. The amber cloud banks, hazy edge and slowed currents here are invented, not measured weather or a solid surface.",
      "observation": "Approach the broad wind bands and fine cloud edges. Pause, orbit and return to the host family.",
      "nextReason": "Compare an imagined hot giant with Jupiter’s attributed historical cloud map.",
      "representationNote": "Unknown surfaces and atmospheres. Colours, geology, frost, clouds, star light, sizes, spacing and slowed motion are authored illustrations, not observations, true scale or current ephemerides."
    },
    "zh": {
      "name": "飞马座 51 b",
      "type": "热气态巨行星",
      "fact": "1995 年径向速度发现 · 公转约 4.2 天",
      "spaceReference": "太阳系外 · 围绕飞马座 51",
      "invitation": "循着另一颗太阳旁的琥珀色云流探索。",
      "story": "这颗气态巨行星约 4.2 天绕 G 型主星一周。这里的琥珀色云岸、霾边与放慢的流动完全由作者设计，不是测量天气，也没有固体表面。",
      "observation": "靠近宽风带与细云边，暂停、环视，再返回主星家族。",
      "nextReason": "比较虚构的热巨行星与有归属历史云图中的木星。",
      "representationNote": "表面与大气未知。颜色、地貌、霜区、云系、恒星照明、尺寸、间距与放慢的运动均为作者示意，不是观测重建、真实比例或当前星历。"
    }
  }
];
DESTINATIONS.push(...EXOPLANET_NOTES.filter(note=>['proxima-b','trappist-e','pegasi-b'].includes(note.key)));

const EXTREME_WORLD_NOTES=EXOWORLDS.flatMap((w,index)=>{
  const next=EXOWORLDS[(index+1)%EXOWORLDS.length];
  const note={key:'extreme-'+w.id,target:w.name,aliases:w.aliases,bodyKind:'planet',spaceRegion:'milky-way',spaceSource:'body',nextTarget:next.name,color:w.accent,sourceLabel:'NASA',sourceUrl:w.sourceUrl};
  const host={key:'extreme-host-'+w.hostId,target:w.host,aliases:w.hostAliases,bodyKind:'star',spaceRegion:'milky-way',spaceSource:'body',nextTarget:w.name,color:w.accent,sourceLabel:'NASA',sourceUrl:w.sourceUrl};
  for(const language of ['en','zh']) {
    const zh=language==='zh';
    const representationNote=zh?'表面、大气纹理、热辐射色彩、主星外观、位置、大小、间距与放慢的活动均为作者示意，不是分辨观测、测量地形、真实比例或当前星历。':'Surface and atmospheric fields, thermal colours, host appearance, positions, sizes, spacing and slowed activity are authored illustrations, not resolved observations, measured terrain, true scale or current ephemerides.';
    note[language]={name:w.name,...w[language],spaceReference:zh?'太阳系外 · 围绕 '+w.host:'Beyond the Solar System · Around '+w.host,nextReason:zh?'继续比较另一颗系外世界的整体结构与近景。':'Compare the broad structure and close detail of another exoplanet.',representationNote};
    host[language]={name:w.host,type:zh?'系外行星的主星':'Exoplanet host star',fact:zh?'本观测台收录 '+(w[language].name||w.name):'A selected companion: '+w.name,spaceReference:zh?'银河系内 · '+w.host+' 行星系统':'Milky Way · '+w.host+' planetary system',invitation:zh?'从共同星光出发，拜访相邻世界。':'Start with the shared starlight and visit its neighbouring world.',story:zh?w.host+' 是 '+(w[language].name||w.name)+' 的主星。此处只展示观测台已收录的成员，不代表该系统全部已知成员。光球与压缩布局属于艺术示意。':w.host+' hosts '+w.name+'. This view includes the members selected for this observatory, rather than a census of the system. Its photosphere and compressed layout are artistic.',observation:zh?'打开共同视角，靠近行星后再返回主星。':'Open the shared view, approach the planet and return to its host.',nextReason:zh?'前往本系统已收录的行星。':'Approach the selected planetary companion.',representationNote};
  }
  return [note,host];
});
DESTINATIONS.push(...EXTREME_WORLD_NOTES.filter(note=>['55 Cancri e','HD 189733 b','GJ 1214 b'].includes(note.target)));

const YOUNG_SYSTEM_NOTES=EXOSYSTEMS.flatMap(system=>{
  const notes=system.worlds.map((w,index)=>{
    const next=system.worlds[(index+1)%system.worlds.length];
    const note={key:'young-'+w.id,target:w.name,aliases:w.aliases,bodyKind:'planet',spaceRegion:'milky-way',spaceSource:'body',nextTarget:next.name,color:w.accent,sourceLabel:'NASA',sourceUrl:w.sourceUrl||system.sourceUrl};
    for(const language of ['en','zh']) {
      const zh=language==='zh';
      note[language]={name:w.name,...w[language],spaceReference:zh?'太阳系外 · 围绕 '+system.host:'Beyond the Solar System · Around '+system.host,nextReason:system.surfaceVariety?(zh?'在同一家族中比较地貌、云层与周围空间。':'Compare terrain, clouds and surrounding space within this family.'):(zh?'在同一家族中比较云层、尺寸与周围空间。':'Compare clouds, display size and surrounding space within this family.'),representationNote:zh?'地貌与云层地理、可见热色、周盘纹理、主星外观、显示尺寸、间距与放慢的活动均为艺术示意；不是分辨天气、实测形态、真实比例或当前星历。':'Terrain and cloud geography, visible thermal colours, disk patterns, host appearance, display sizes, spacing and slowed activity are artistic; they are not resolved weather, measured morphology, true scale or current ephemerides.'};
    }
    return note;
  });
  const host={key:'young-host-'+system.hostId,target:system.host,aliases:system.hostAliases,bodyKind:'star',spaceRegion:'milky-way',spaceSource:'body',nextTarget:system.worlds[0].name,color:system.worlds[0].accent,sourceLabel:'NASA',sourceUrl:system.sourceUrl};
  for(const language of ['en','zh']) {
    const zh=language==='zh';
    host[language]={name:system.host,type:system.surfaceVariety?(zh?'行星家族的主星':'Host of a planetary family'):(zh?'年轻行星家族的主星':'Host of a young planetary family'),fact:zh?'本观测台收录 '+system.worlds.length+' 颗行星':'Explore '+system.worlds.length+' selected planets',spaceReference:zh?'银河系内 · '+system.host+' 行星系统':'Milky Way · '+system.host+' planetary system',invitation:zh?'从共同星光出发，连续比较相邻世界。':'Start with shared starlight and compare neighbouring worlds.',story:zh?'这个家族展示本观测台已收录的成员。打开共同视角可辨认归属和压缩后的空间关系，再逐一接近。光球、云层和布局是艺术表达，不是完整天文学目录或当前星历。':'This family contains members selected for the observatory. The shared view reveals their host and compressed spatial relationships before individual approaches. Photospheres, clouds and layout are artistic, not a complete astronomical census or current ephemeris.',observation:zh?'打开共同视角，选择一颗行星，再拜访其他成员或返回主星。':'Open the shared view, choose a planet, visit siblings and recover the host.',nextReason:zh?'开始探索本家族的行星。':'Begin exploring the planets of this family.',representationNote:notes[0][language].representationNote};
  }
  return [host,...notes];
});
DESTINATIONS.push(...YOUNG_SYSTEM_NOTES.filter(note=>['HR 8799 e','PDS 70 c','Kepler-51 d','Kepler-90 i','Kepler-11 e'].includes(note.target)));

const NEBULA_EXPLORATION_NOTES=NEBULA_EXPLORATIONS.map(body=>{
  const representation={en:'Cloud geometry, light positions, colour, density, activity and compressed scale are authored illustrations, not telescope imagery, measured 3D structure or physical radiative transfer.',zh:'云体形状、亮点位置、颜色、密度、活动与压缩尺度均为作者示意，并非望远镜图像、实测三维结构或物理辐射转移。'};
  const note={key:body.material+'-nebula',target:body.name,aliases:body.aliases,bodyKind:'nebula',
    spaceRegion:body.region||'milky-way',spaceSource:'body',nextTarget:body.nextTarget,
    sourceLabel:body.sourceUrl.includes('esa')?'ESA / NASA':'NASA',sourceUrl:body.sourceUrl,color:body.accent};
  for(const language of ['en','zh'])note[language]={name:body.name,...body[language],observation:body[language].invitation,
    representationNote:representation[language],story:body[language].story+' '+representation[language]};
  return note;
});
DESTINATIONS.push(...NEBULA_EXPLORATION_NOTES.filter(note=>['trifid','tarantula','iris','redrectangle'].some(material=>note.key===material+'-nebula')));

const GALAXY_EXPLORATION_NOTES=GALAXY_EXPLORATIONS.map(body=>{
  const representation={en:'Three-dimensional shape, local lights, colour, activity, placement and compressed scale are authored illustrations, not telescope imagery, measured stellar positions or a simulation of an encounter.',zh:'三维形状、局部亮点、颜色、活动、位置与压缩尺度均为作者示意，并非望远镜图像、实测恒星位置或星系相遇模拟。'};
  const note={key:body.material+'-galaxy',target:body.name,aliases:body.aliases,bodyKind:'galaxy',spaceRegion:'outside-milky-way',spaceSource:'body',nextTarget:body.nextTarget,sourceLabel:body.sourceUrl.includes('esa')?'ESA / NASA':'NASA',sourceUrl:body.sourceUrl,color:body.accent};
  for(const language of ['en','zh'])note[language]={...body[language],observation:body[language].invitation,representationNote:representation[language],story:body[language].story+' '+representation[language]};
  return note;
});
DESTINATIONS.push(...GALAXY_EXPLORATION_NOTES.filter(note=>['pinwheel','antennae','hoag','polarring'].some(key=>note.key===key+'-galaxy')));

export const TARGET_NOTES = [...GALAXY_EXPLORATION_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...NEBULA_EXPLORATION_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...YOUNG_SYSTEM_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...EXTREME_WORLD_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...EXOPLANET_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...COMPACT_REMNANT_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...FRONTIER_BINARY_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...GALAXY_PORTRAIT_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...SCULPTED_NEBULA_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...SMALL_SATELLITE_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...REMOTE_WORLD_NOTES.filter(note=>!DESTINATIONS.includes(note)), ...DESTINATIONS, ...SOLAR_NOTES, ...SATELLITE_NOTES, ...SMALL_WORLD_NOTES, ...FRONTIER_NOTES.filter(note=>!DESTINATIONS.includes(note)),
{
  "key": "ceres",
  "target": "Ceres",
  "bodyKind": "dwarfplanet",
  "spaceRegion": "solar-system",
  "nextTarget": "Vesta",
  "color": "#aaaaaa",
  "sourceLabel": "NASA",
  "sourceUrl": "https://science.nasa.gov/dwarf-planets/ceres/facts/",
  "mapSourceLabel": "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA · Dawn HAMO clear-filter mosaic · resized, polar coverage marked",
  "mapSourceUrl": "https://dawngis.dlr.de/data/Ceres/mosaic_ceres.php",
  "en": {
    "name": "Ceres",
    "type": "Main-belt dwarf planet",
    "fact": "Bright deposits in Occator crater · Visited by Dawn",
    "invitation": "Look for bright spots among a dark world’s craters.",
    "story": "Ceres lies between Mars and Jupiter. Occator contains bright salt-rich deposits. The Dawn HAMO clear-filter mosaic is monochrome. Original mosaic lighting and incomplete polar coverage remain; marked polar edge gaps are plain grey. Shape, light, brightness-derived relief, rotation and orbit spacing are artistic, not measured height or a live ephemeris.",
    "observation": "Approach the bright crater floor and nearby dark basins. Orbit, compare Vesta, then return to the Solar System.",
    "nextReason": "Compare bright deposits with another main-belt world’s troughs."
  },
  "zh": {
    "name": "谷神星",
    "type": "主小行星带中的矮行星",
    "fact": "奥卡托撞击坑中的亮斑 · Dawn 曾抵达",
    "invitation": "在布满撞击坑的暗色世界上，寻找亮斑。",
    "story": "谷神星位于火星与木星之间，奥卡托撞击坑含有富盐亮色沉积物。Dawn 高轨道灰度镶嵌图保留原始明暗及不完整的极区覆盖，已标出的极区边缘缺测用平坦灰色表示。形状近似、受光、亮度衍生的起伏、转动与轨道间距均为艺术表现，并非实测高程或实时星历。",
    "observation": "靠近亮色坑底与附近的暗色盆地，环视后比较灶神星，再返回太阳系。",
    "nextReason": "比较另一个主带世界的沟槽与撞击地貌。"
  }
},
{
  "key": "vesta",
    "shapeSourceLabel": "NASA VTAD · 3D visualization",
    "shapeSourceUrl": "https://science.nasa.gov/resource/vesta-3d-model/",
  "target": "Vesta",
  "bodyKind": "asteroid",
  "spaceRegion": "solar-system",
  "nextTarget": "Ceres",
  "color": "#aaaaaa",
  "sourceLabel": "NASA",
  "sourceUrl": "https://science.nasa.gov/mission/dawn/science/vesta/",
  "mapSourceLabel": "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA · Dawn HAMO clear-filter mosaic · resized, polar coverage marked",
  "mapSourceUrl": "https://dawngis.dlr.de/data/Vesta/mosaic_vesta.php",
  "en": {
    "name": "Vesta",
    "type": "Rocky main-belt asteroid",
    "fact": "A non-spherical world · Huge south-polar impact basin",
    "invitation": "Meet a small world with a dramatic impact history.",
    "story": "Vesta has long troughs and a large south-polar impact basin. The solid, including broad concave terrain, is simplified from NASA’s 3D visualization model and uniformly fitted inside the display proportions. The retained historical map is not registered to model UVs; these visualization assets and fine shading do not provide a new measured height layer. The Dawn HAMO clear-filter mosaic is monochrome. Original mosaic lighting and incomplete polar coverage remain; marked polar edge gaps are plain grey. Shape, light, brightness-derived relief, rotation and orbit spacing are artistic, not measured height or a live ephemeris.",
    "observation": "Orbit the flattened outline, follow the equatorial troughs toward the southern terrain, then compare Ceres or return.",
    "nextReason": "Compare the impact landscape with Ceres’ bright crater deposits."
  },
  "zh": {
    "name": "灶神星",
    "type": "主小行星带的岩质小行星",
    "fact": "非球形世界 · 巨大的南极撞击盆地",
    "invitation": "观察一个保留剧烈撞击历史的小世界。",
    "story": "灶神星有延伸的沟槽与大型南极撞击盆地。实体及宽阔凹陷地形由 NASA 三维可视化模型简化而成，统一缩放至显示比例内；保留的历史底图未与原模型 UV 配准，可视化资产和细节受光也不提供新的实测高程层。Dawn 高轨道灰度镶嵌图保留原始明暗及不完整的极区覆盖，已标出的极区边缘缺测用平坦灰色表示。形状近似、受光、亮度衍生的起伏、转动与轨道间距均为艺术表现，并非实测高程或实时星历。",
    "observation": "环视较扁的轮廓，沿赤道沟槽观察南部地貌，再比较谷神星或返回太阳系。",
    "nextReason": "比较谷神星的亮色坑内沉积物。"
  }
},
{
  "key": "pluto",
  "target": "Pluto",
  "bodyKind": "dwarfplanet",
  "spaceRegion": "solar-system",
  "nextTarget": "Charon",
  "color": "#c5a58a",
  "sourceLabel": "NASA",
  "sourceUrl": "https://science.nasa.gov/dwarf-planets/pluto/",
  "mapSourceLabel": "NASA/JHUAPL/SwRI · New Horizons MVIC · resized, missing coverage marked",
  "mapSourceUrl": "https://science.nasa.gov/resource/pluto-global-color-map/",
  "en": {
    "name": "Pluto",
    "type": "Kuiper Belt dwarf planet",
    "fact": "A bright nitrogen-ice plain · New Horizons flyby in 2015",
    "invitation": "Find a pale heart on a distant, reddish ice world.",
    "story": "Sputnik Planitia is the bright western half of Pluto’s heart-shaped region. The 2015 New Horizons colour mosaic has uneven resolution and incomplete southern coverage. Unmapped areas are shown as plain grey, not inferred terrain. The source’s colour and mosaic lighting remain; sphere, brightness-derived relief, rotation and spacing are artistic.",
    "observation": "Follow the edge of the bright ice plain into darker reddish terrain. Orbit to compare the mapped and unobserved regions, then visit Charon or return to their shared space.",
    "nextReason": "Compare Pluto’s bright ice plains with its large companion’s fractured landscape."
  },
  "zh": {
    "name": "冥王星",
    "type": "柯伊伯带矮行星",
    "fact": "明亮的氮冰平原 · 2015 年新视野号飞掠",
    "invitation": "在遥远的红褐色冰世界上，寻找浅色的心。",
    "story": "斯普特尼克平原是冥王星心形区域明亮的西半部。2015 年新视野号色彩镶嵌图的分辨率不均，南部覆盖不完整；缺测区域用平坦灰色表示，不推测地貌。保留底图色彩与镶嵌光照，球体、亮度衍生的起伏、转动与间距均为艺术表现。",
    "observation": "沿明亮冰原的边缘观察较暗的红褐色地貌，环视比较有底图与缺测区域；再拜访卡戎或返回它们的共同空间。",
    "nextReason": "与大型伴侣卡戎的断裂地貌比较。"
  }
},
{
  "key": "charon",
  "target": "Charon",
  "bodyKind": "moon",
  "spaceRegion": "solar-system",
  "nextTarget": "Pluto",
  "color": "#b3b4b8",
  "sourceLabel": "NASA",
  "sourceUrl": "https://science.nasa.gov/dwarf-planets/pluto/moons/charon/",
  "mapSourceLabel": "NASA/JHUAPL/SwRI · New Horizons LORRI · resized, missing coverage marked",
  "mapSourceUrl": "https://science.nasa.gov/photojournal/global-map-of-plutos-moon-charon/",
  "en": {
    "name": "Charon",
    "type": "Pluto’s largest moon",
    "fact": "About half Pluto’s diameter · Fractured icy terrain",
    "invitation": "Meet the large companion of a dwarf planet.",
    "story": "Charon’s surface has craters, plains and a broad system of fractures. This early July 2015 New Horizons LORRI mosaic is monochrome, with different resolutions and missing southern coverage. Unmapped areas are plain grey. Original mosaic shading remains; the globe, illumination, brightness-derived relief, rotation and parent-centred orbit are artistic, not measured height or a barycentric ephemeris.",
    "observation": "Approach the long fracture belt and cratered terrain. Withdraw to see Pluto beside its moon, choose a large or small family member, and return to the Solar System.",
    "nextReason": "Return to Pluto’s reddish terrain and bright heart-shaped region."
  },
  "zh": {
    "name": "卡戎",
    "type": "冥王星最大的卫星",
    "fact": "直径约为冥王星的一半 · 断裂的冰地貌",
    "invitation": "拜访矮行星身边的大型伴侣。",
    "story": "卡戎的表面有撞击坑、平原与宽广的断裂系统。这张早期的 2015 年 7 月新视野号 LORRI 底图为灰度图，分辨率不同，南部存在缺测；缺测区域用平坦灰色表示。保留镶嵌明暗，球体、受光、亮度衍生的起伏、转动与围绕所属天体的轨道是艺术示意，并非实测高程或双星质心星历。",
    "observation": "接近延伸的断裂带与撞击坑地貌，退离后在共同空间观察冥王星与卫星；选择大小不同的家族成员，再返回太阳系。",
    "nextReason": "返回冥王星，比较红褐色地貌与明亮的心形区域。"
  }
}, {
  key: 'vega', target: 'Vega', spaceRegion: 'milky-way', nextTarget: 'Sol', color: '#b8dfff', sourceLabel: 'NASA / Hubble & Webb',
  sourceUrl: 'https://science.nasa.gov/missions/hubble/nasas-hubble-webb-probe-surprisingly-smooth-disk-around-vega/',
  en: {
    name: 'Vega', type: 'Blue-white star', fact: 'A bright star in the constellation Lyra',
    invitation: 'Visit the bright star whose surrounding dust has surprised astronomers.',
    story: 'Hubble and Webb have observed a remarkably smooth debris disk around Vega. This scene represents the star; the surrounding starlight is an artistic environment, not that observed disk.',
    observation: 'Orbit its blue-white surface, then compare the colour with our Sun.',
    nextReason: 'Travel from blue-white light to the warmer colours of our home star.'
  },
  zh: {
    name: '织女星', type: '蓝白恒星', fact: '天琴座的一颗亮星',
    invitation: '拜访那颗让天文学家好奇于周围尘埃的亮星。',
    story: '哈勃与韦布望远镜观察到织女星周围格外平滑的碎屑盘。这里呈现恒星本身；周围星光是艺术化环境，并非那片被观测到的碎屑盘。',
    observation: '环视蓝白的表面，再与太阳的暖色光比较。',
    nextReason: '从蓝白星光，回到我们恒星的温暖色彩。'
  }
}, {
  key: 'moon', target: 'Moon', aliases: ['Luna'], bodyKind: 'moon', spaceRegion: 'solar-system', nextTarget: 'Sol', color: '#c1bbb1', sourceLabel: 'NASA',
  sourceUrl: 'https://science.nasa.gov/moon/facts/',
  en: {
    name: 'Moon', type: 'Earth’s natural satellite', fact: 'Rocky highlands · Ancient lava plains',
    invitation: 'Visit our nearest companion, then look back at Earth.',
    story: 'Impact craters mark the Moon’s rocky surface. The darker maria are ancient lava plains. NASA’s LRO colour and elevation maps provide the surface clues here; relief, lighting and the Earth–Moon spacing are artistic representations, not a live orbit.',
    observation: 'Orbit the cratered surface and its day–night boundary. Earth remains a small world beyond the Moon.',
    nextReason: 'From reflected lunar light to the star that supplies it.'
  },
  zh: {
    name: '月球', type: '地球的天然卫星', fact: '岩石高地 · 古老的熔岩平原',
    invitation: '拜访我们最近的伴侣，再回望地球。',
    story: '撞击留下的陨石坑遍布月球岩石地表，较暗的月海是古老的熔岩平原。这里使用 NASA LRO 色彩与高程底图；地形增强、光照和地月间距为艺术化表达，并非实时轨道。',
    observation: '环视陨石坑与昼夜交界。月球之外，地球仍是一颗可以回望的小世界。',
    nextReason: '从月球反射的光，前往照亮它的太阳。'
  }
}, {
  key: 'mars', target: 'Mars', bodyKind: 'planet', spaceRegion: 'solar-system', nextTarget: 'Earth', color: '#e79462', sourceLabel: 'NASA',
  sourceUrl: 'https://science.nasa.gov/mars/facts/',
  mapSourceUrl: 'https://www.solarsystemscope.com/textures/', mapSourceLabel: 'Solar System Scope / INOVE · CC BY 4.0',
  en: {
    name: 'Mars', type: 'Rocky desert planet', fact: 'Fourth planet from the Sun · A thin atmosphere',
    invitation: 'Travel from our ocean world to a rust-coloured desert.',
    story: 'Iron minerals give Mars its rusty colour. It is cold and dry today, but ancient channels and lakebeds point to a wetter past. The NASA-based map by Solar System Scope enhances colour and fills missing areas. Map-derived relief, haze, lighting and spacing are artistic; this is not a live observation.',
    observation: 'Orbit the dark terrain, pale polar cap and day–night boundary. Compare the dry landscape with Earth’s oceans and clouds.',
    nextReason: 'Return to our ocean world and look for the differences in clouds, colour and reflected light.'
  },
  zh: {
    name: '火星', type: '荒漠岩石行星', fact: '太阳的第四颗行星 · 稀薄的大气',
    invitation: '从我们的海洋世界，前往铁锈色的荒漠。',
    story: '铁矿物让火星呈现铁锈色。如今它寒冷而干燥，古老河道与湖床却留下更湿润的往昔。底图由 Solar System Scope 基于 NASA 数据增强色彩并填补缺测区域；底图衍生的起伏、薄雾、光照与间距为艺术化表达，并非实时观测。',
    observation: '环视暗色地貌、浅色极冠和昼夜交界，与地球的海洋和云系比较。',
    nextReason: '回到海洋世界，再看云层、色彩与反射光有什么不同。'
  }
}, {
  key: 'jupiter', target: 'Jupiter', bodyKind: 'planet', spaceRegion: 'solar-system', nextTarget: 'Earth', color: '#dfbb92', sourceLabel: 'NASA',
  sourceUrl: 'https://science.nasa.gov/jupiter/jupiter-facts/',
  mapSourceUrl: 'https://www.solarsystemscope.com/textures/', mapSourceLabel: 'Solar System Scope / INOVE · CC BY 4.0',
  en: {
    name: 'Jupiter', type: 'Gas giant', fact: 'Largest planet · Fifth from the Sun · No solid surface',
    invitation: 'Follow the cloud bands to a world of enduring storms.',
    story: 'Jupiter’s light zones and dark belts flow in opposite directions. The Great Red Spot is a giant, long-lived storm. These are cloud tops, not a landing surface. The NASA-based map by Solar System Scope enhances colour and fills missing areas; wind, rotation, lighting and spacing are artistic, not current weather.',
    representationNote: 'Historical cloud map with illustrative cloud-bank shading and fine filaments; brightness is not measured cloud altitude, and this is not current weather.',
    observation: 'Orbit to find the Great Red Spot’s oval shape, smaller storms and the day–night boundary. Move closer to follow the eddies in the cloud bands.',
    nextReason: 'Compare this world of cloud tops with Earth’s solid continents and liquid oceans.'
  },
  zh: {
    name: '木星', type: '气态巨行星', fact: '最大的行星 · 太阳的第五颗行星 · 没有固体表面',
    invitation: '沿着云带，寻找经久不息的风暴。',
    story: '木星的浅色区与暗色带朝相反方向流动，大红斑是一场持续很久的巨型风暴。所见是云顶，并非可着陆地表。底图由 Solar System Scope 基于 NASA 数据增强色彩并填补缺测区域；风、旋转、光照与间距为艺术化表达，不是当前天气。',
    representationNote: '历史云图上的云岸受光和细流为艺术示意；亮度不是测量云层高度，也不是当前天气。',
    observation: '环视寻找大红斑的椭圆轮廓、较小风暴与昼夜交界，继续靠近云带中的涡流。',
    nextReason: '与地球的固体大陆和液态海洋对照，观察云顶世界有什么不同。'
  }
}, {
  key: 'halley', target: "Halley's Comet", aliases: ['Halley', '1P/Halley', '1P Halley'], bodyKind: 'comet', spaceRegion: 'solar-system', nextTarget: 'Moon', color: '#a8d7e4', sourceLabel: 'NASA',
  sourceUrl: 'https://science.nasa.gov/solar-system/comets/1p-halley/',
  en: {
    name: 'Halley’s Comet', type: 'Periodic comet', fact: 'About 76 years per orbit · Visited by Giotto in 1986',
    invitation: 'Follow two tails back to a small, dark nucleus.',
    story: 'Halley has a dark, elongated nucleus. Near the Sun, escaping gas and dust form a coma and tails; the blue ion tail points away from the Sun, while dust spreads into a curved tail. The nucleus, jets, compressed tails and position here are procedural art, not a reconstructed spacecraft model or a live orbit.',
    observation: 'First orbit the blue gas tail and curved dust tail. Move closer to examine the dark nucleus and sunlit ridges; the Sun is its source of energy.',
    nextReason: 'Compare this small, active body with the Moon’s cratered, airless surface.'
  },
  zh: {
    name: '哈雷彗星', type: '周期彗星', fact: '公转周期约 76 年 · 1986 年乔托号探访',
    invitation: '沿着两道尾迹，寻找小而暗的彗核。',
    story: '哈雷拥有暗色、细长的彗核。接近太阳时，逸出的气体与尘埃形成彗发和尾迹；蓝色离子尾背向太阳，尘尾则弯曲扩散。这里的彗核、喷流、压缩尾迹与位置均为程序生成的艺术表达，并非航天器测量模型或实时轨道。',
    observation: '先环视蓝色气体尾与弯曲尘尾，再靠近暗色彗核，观察受光岩脊。太阳是驱动这些活动的能量来源。',
    nextReason: '与月球满布陨石坑、没有空气的地表比较，看看活跃的小天体有什么不同。'
  }
}, {

  "key": "sirius-b",
  "target": "Sirius B",
  "aliases": [
    "SiriusB",
    "Alpha Canis Majoris B",
    "天狼星B",
    "天狼星 B"
  ],
  "bodyKind": "star",
  "spaceRegion": "milky-way",
  "spaceSource": "body",
  "nextTarget": "Sirius",
  "color": "#c5deff",
  "sourceLabel": "ESA / Hubble",
  "sourceUrl": "https://esahubble.org/news/heic0516/",
  "en": {
    "name": "Sirius B",
    "type": "White dwarf · Stellar remnant",
    "fact": "Roughly Earth-sized · Nearly a solar mass",
    "spaceReference": "Companion in the Sirius binary",
    "invitation": "Find a dense remnant beside the brilliant Dog Star.",
    "story": "Sirius B is a hot white dwarf: a small, dense remnant that has exhausted its nuclear fuel. Hubble measurements found a diameter around 12,000 km and nearly the Sun’s mass. Its pale thermal layers, glow, size, separation and parent-centred motion here are procedural illustrations, not measured surface detail, true scale or a barycentric ephemeris.",
    "observation": "Approach the compact, pale thermal layers and gentle curved heat fronts without solar coronal arcs. Orbit, pause or compare its companion; return to their shared space to see the relationship.",
    "nextReason": "Return to the much larger blue-white main star."
  },
  "zh": {
    "name": "天狼星 B",
    "type": "白矮星 · 恒星残骸",
    "fact": "大小接近地球 · 质量接近太阳",
    "spaceReference": "天狼星双星系统的伴星",
    "invitation": "在明亮天狼星旁，寻找一颗致密的残骸。",
    "story": "天狼星 B 是炽热的白矮星：核燃料耗尽后留下的小而致密的残骸。哈勃测量得到约 12,000 公里的直径和接近太阳的质量。这里淡色热层、光晕、尺寸、间距与围绕主星的运动是程序示意，不是表面测量、真实比例或质心星历。",
    "observation": "靠近紧凑、淡色的热结构，辨认缓慢流动的弯曲热层；这里没有太阳式日冕弧。环视、暂停或对照主星，再返回共同空间理解它们的关系。",
    "nextReason": "返回大得多的蓝白主星。"
  }

}, {
  key: 'crab-pulsar', target: 'Crab Pulsar', aliases: ['Crab', 'PSR B0531+21'], bodyKind: 'pulsar', spaceRegion: 'milky-way', spaceSource: 'body', nextTarget: 'Sol', color: '#84c7ee', sourceLabel: 'NASA / Hubble',
  sourceUrl: 'https://science.nasa.gov/missions/hubble/the-crab-nebula/',
  observationSourceLabel: 'NASA / CXC · Chandra', observationSourceUrl: 'https://chandra.harvard.edu/photo/2002/0052/animations.html',
  en: {
    name: 'Crab Pulsar', type: 'Neutron star · Slow beam illustration', fact: 'A supernova remnant · About 30 rotations per second',
    spaceReference: 'At the centre of the Crab Nebula',
    invitation: 'Meet a stellar remnant whose beams sweep like a lighthouse.',
    representationNote: 'Thermal patterns, magnetic beams, colours and slowed activity are authored illustrations, not a surface measurement, pulse prediction or a relativistic simulation.',
    story: 'At the centre of the Crab Nebula is a rapidly rotating neutron star, left by the supernova recorded in 1054. Radiation near its magnetic poles sweeps through space as it turns. Observations of its surroundings show changing wisps and jets. The visible wind knots, beams, magnetic curves, thermal core, colours, position and size here are procedural illustrations. Motion is greatly slowed for observation; this is not real pulse timing, surface measurement or a telescope reconstruction.',
    observation: 'Follow the outward wisps toward the compact core. The bright magnetic caps sit within a smooth thermal shoulder; approach to inspect their transition into the darker core. Pause to compare the caps and curved field illustration.',
    nextReason: 'Compare a compact stellar remnant with the extended plasma of our home star.'
  },
  zh: {
    name: '蟹状脉冲星', type: '中子星 · 放慢的辐射束示意', fact: '超新星留下的致密核心 · 每秒约转动 30 次',
    spaceReference: '蟹状星云的中央',
    invitation: '拜访恒星留下的致密核心，看辐射束像灯塔一样扫过空间。',
    representationNote: '冷热图案、磁极扫束、颜色与放慢的活动为作者示意，并非表面测量、脉冲预报或相对论模拟。',
    story: '蟹状星云中央是一颗快速转动的中子星，由公元 1054 年被记录的超新星留下。随着它转动，磁极附近的辐射束扫过空间；周围的风纹与喷流也有持续变化的观测记录。这里的风纹亮结、辐射束、磁场弧线、发光核心、色彩、位置与尺寸是程序生成的示意；活动大幅放慢，便于观察，不是真实脉冲计时、表面测量或望远镜数据重建。',
    observation: '循着向外传播的风纹接近致密核心。明亮磁极连接平滑的冷热层，继续靠近观察热极到深色核心的温度过渡；暂停后环视磁极与弯曲磁场示意。',
    nextReason: '对照致密的恒星残骸与太阳广阔的等离子体。'
  }
}, {
  key: 'sagittarius-a', target: 'Sagittarius A*', aliases: ['Sgr A*', 'Sgr A', 'Sagittarius A', '黑洞', '银河中心'], bodyKind: 'blackhole',
  spaceRegion: 'milky-way', spaceSource: 'body', nextTarget: 'Crab Pulsar', color: '#e8ab62', sourceLabel: 'NASA',
  sourceUrl: 'https://science.nasa.gov/universe/black-holes/anatomy/',
  spaceSourceUrl: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-is-the-center-of-our-galaxy-like/',
  en: {
    name: 'Sagittarius A*', type: 'Supermassive black hole · Light-path illustration', fact: 'At the heart of the Milky Way · About four million solar masses',
    spaceReference: 'The Galactic centre',
    invitation: 'Find a dark centre through the light of surrounding matter.',
    story: 'Sagittarius A* is the supermassive black hole at the centre of our galaxy. Light cannot escape its event horizon; the light seen around a black hole comes from matter outside it. A spinning accretion disk and bent light can frame a dark shadow and thin photon ring. Sagittarius A* is relatively quiet. This bright disk, colour, shadow, bent arcs, scale and slow flow are artistic illustrations, not a telescope image, measured accretion or a relativistic simulation.',
    observation: 'Orbit from the tilted disk to its face and edge. Follow bright flowing packets and darker channels toward the inner glow, then compare the thin light ring with the central shadow. Pause or continue closer.',
    nextReason: 'Compare the dark shadow and surrounding matter with a neutron star and its sweeping beams.'
  },
  zh: {
    name: '射手座 A*', type: '超大质量黑洞 · 光路示意', fact: '银河系的中央 · 质量约为太阳的四百万倍',
    spaceReference: '银河中心',
    invitation: '循着周围物质的光，发现中央的暗影。',
    story: '射手座 A* 是银河系中央的超大质量黑洞。光无法逃离事件视界，黑洞周围的可见光来自视界之外的物质。转动的吸积盘与弯曲的光路可以围出暗影和细薄光环。射手座 A* 相对平静；这里明亮的盘面、颜色、暗影、弯曲光弧、尺度与放慢的流动是艺术化示意，并非望远镜图像、测量的吸积活动或相对论模拟。',
    observation: '从倾斜盘面环视到正面和侧缘，循着明亮流纹与暗隙接近内侧热层，再比较细薄光环与中央暗影。可以暂停或继续靠近。',
    nextReason: '对照黑洞暗影与周围物质，再看中子星扫过空间的辐射束。'
  }
}, {
  "key": "vela-pulsar",
  "target": "Vela Pulsar",
  "aliases": [
    "Vela",
    "PSR B0833-45",
    "PSR J0835-4510",
    "船帆座脉冲星"
  ],
  "bodyKind": "pulsar",
  "spaceRegion": "milky-way",
  "spaceSource": "body",
  "nextTarget": "Crab Pulsar",
  "color": "#83dfe6",
  "sourceLabel": "NASA / CXC · Chandra",
  "sourceUrl": "https://chandra.harvard.edu/photo/2013/vela/",
  "observationSourceLabel": "NASA / CXC · Chandra",
  "observationSourceUrl": "https://chandra.harvard.edu/photo/2003/vela_pulsar/",
  "en": {
    "name": "Vela Pulsar",
    "type": "Neutron star · Wind and jet illustration",
    "fact": "About 1,000 light years away · Over 11 rotations per second",
    "spaceReference": "Inside the Vela supernova remnant",
    "invitation": "Follow a bending jet out from a tiny stellar remnant.",
    "representationNote": "Thermal patterns, magnetic beams, colours and slowed activity are authored illustrations, not a surface measurement, pulse prediction or a relativistic simulation.",
    "story": "Vela is a rapidly rotating neutron star left by a supernova. Chandra observations show a narrow particle jet, moving bright knots and changes in its shape. The wind arcs, thermal core, magnetic curves and compressed jet here are procedural illustrations inspired by these observations. Colours and activity are authored and slowed; this is not pulse timing, surface measurement or an X-ray reconstruction. The possible precession of the observed jet remains an interpretation, not a measured animation in this scene.",
    "observation": "Find the two wind arcs and curved jet, then approach the narrow hot caps and darker thermal envelope. Approach to inspect the smooth transition around the caps. Distinguish the narrow wind jet along the spin axis from the wider magnetic beams sweeping with the hot caps.",
    "nextReason": "Compare Vela’s curved jet and double wind arcs with the Crab’s outward-moving wisps."
  },
  "zh": {
    "name": "船帆座脉冲星",
    "type": "中子星 · 恒星风与喷流示意",
    "fact": "距离约一千光年 · 每秒转动超过 11 次",
    "spaceReference": "船帆座超新星遗迹内部",
    "invitation": "从微小的恒星残骸出发，循着弯曲喷流观察它的周围。",
    "representationNote": "冷热图案、磁极扫束、颜色与放慢的活动为作者示意，并非表面测量、脉冲预报或相对论模拟。",
    "story": "船帆座脉冲星是超新星留下的快速转动中子星。钱德拉观测记录了狭窄的粒子喷流、移动亮结及形状变化。这里的双弧风区、发光核心、磁场曲线与压缩喷流是受这些观测启发的程序示意；颜色与活动经过设计并放慢，不是真实脉冲计时、表面测量或 X 射线重建。观测喷流可能存在进动仍是一种解释，不能把场景动画视为测量结果。",
    "observation": "先辨认两道风弧与弯曲喷流，再靠近较窄的发光磁极和深色冷热层；继续接近观察热极周围平滑的温度过渡。区分沿自转轴延伸的狭窄风区喷流与跟随热极扫动的较宽磁极辐射束。",
    "nextReason": "比较船帆座的弯曲喷流、双弧风区与蟹状脉冲星向外传播的风纹。"
  }
}, {
  "key": "messier-87",
  "target": "M87*",
  "aliases": [
    "M87",
    "Messier 87",
    "Powehi",
    "室女座黑洞"
  ],
  "bodyKind": "blackhole",
  "spaceRegion": "outside-milky-way",
  "spaceSource": "body",
  "nextTarget": "Sagittarius A*",
  "color": "#d9b38b",
  "sourceLabel": "NASA / CXC · Chandra",
  "sourceUrl": "https://www.nasa.gov/image-article/famous-black-hole-has-jet-pushing-cosmic-speed-limit/",
  "en": {
    "name": "M87*",
    "type": "Supermassive black hole · Disk and jet illustration",
    "fact": "About 55 million light years away · About 6.5 billion solar masses",
    "spaceReference": "At the centre of the galaxy Messier 87, in Virgo",
    "invitation": "Trace a bright jet back to the dark centre that powers it.",
    "story": "M87* is the supermassive black hole at the centre of Messier 87. Observations in radio, optical and X-ray light reveal a narrow jet with bright knots; Chandra measurements indicate particles moving close to the speed of light. The observed jet is vastly larger than the horizon-scale ring. This scene strongly compresses that scale difference so both can be explored together. Disk, shadow, bent light, colours, jet knots and slow flow are artistic procedural illustrations, not telescope images, measured activity or a relativistic simulation.",
    "observation": "Read the long jet and moving knots from the whole view, then approach warmer disk packets, dark channels and inner flow. Orbit to see the jet rise out of the disk plane; at close range the distant jet continues beyond the view.",
    "nextReason": "Compare the jet-bearing M87* illustration with the relatively quiet black hole at our Galactic centre."
  },
  "zh": {
    "name": "M87*",
    "type": "超大质量黑洞 · 吸积盘与喷流示意",
    "fact": "距离约五千五百万光年 · 质量约为太阳的 65 亿倍",
    "spaceReference": "室女座方向，M87 星系的中央",
    "invitation": "沿着明亮喷流，追溯驱动它的中央暗影。",
    "story": "M87* 是 M87 星系中央的超大质量黑洞。射电、可见光和 X 射线观测显示狭窄喷流与亮结；钱德拉测量表明其中粒子接近光速。实际喷流远比视界尺度的光环巨大。这里大幅压缩了两者尺度差异，便于在同一旅程中观察。盘面、暗影、弯曲光路、颜色、喷流亮结与放慢的流动均为程序生成的艺术示意，并非望远镜图像、测量的活动或相对论模拟。",
    "observation": "整体先看长喷流与亮结，再接近较暖的盘面、暗隙和内侧流纹。环视喷流与盘面垂直的关系；近景时远端喷流会延伸到视野之外。",
    "nextReason": "对照带有喷流的 M87* 示意与银河中心相对平静的黑洞。"
  }
}];

// Legacy named stars resolve to an individual primary astronomical database entry.
// These references establish identity; simulated surfaces and map coordinates are not measurements.
const NAMED_STAR_SOURCES = new Set([
  'Rigil Kentaurus', "Barnard's Star", 'Epsilon Eridani', '61 Cygni', 'Tau Ceti', 'Altair',
  'Fomalhaut', 'Pollux', 'Arcturus', 'Capella', 'Aldebaran', 'Regulus', 'Spica', 'Antares',
  'Rigel', 'Deneb', 'Canopus', 'Polaris'
]);
function namedStarSource(name) {
  return NAMED_STAR_SOURCES.has(name) ? { sourceLabel: 'CDS / SIMBAD',
    sourceUrl: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(name)}` } : {};
}

// A finite presentation index for the scene; catalog identities remain canonical.
// Build once at startup, rather than searching editorial notes during each frame.
export function targetDisplayNames(language = 'en') {
  const locale = language === 'zh' ? 'zh' : 'en';
  return new Map(TARGET_NOTES.map(note => [note.target, note[locale].name]));
}

export function describeTarget(name, language = 'en') {
  const locale = language === 'zh' ? 'zh' : 'en';
  const destination = TARGET_NOTES.find(item => item.target === name);
  if (destination) return { bodyKind: 'star', ...destination, ...destination[locale], kind: 'named' };
  const generated = /^UO \d+$/.test(name || '');
  const zh = locale === 'zh';
  return {
    ...namedStarSource(name), target: name, name: name || '—', bodyKind: 'star', kind: generated ? 'procedural' : 'named',
    type: generated ? (zh ? '程序生成恒星' : 'Procedural star') : (zh ? '已命名恒星' : 'Named star'),
    fact: zh ? '场景位置与尺寸经过艺术化压缩' : 'Scene positions and sizes are artistically compressed',
    invitation: zh ? '沿着星光，发现属于你的观察目标。' : 'Follow the starlight to an observation of your own.',
    story: generated
      ? (zh ? '这颗恒星由固定种子生成。名称、位置和表面属于模拟内容，不代表真实天文观测。' : 'This star is generated from a fixed seed. Its name, position and surface are simulated content, not astronomical observations.')
      : (zh ? '名称对应真实恒星。此处的位置、尺寸和表面是探索用的艺术化模拟，不是测量数据。' : 'The name refers to a real star. Its position, size and surface here are artistic representations for exploration, not measurements.'),
    observation: zh ? '拖拽环视 · 加减键接近或离开' : 'Drag to orbit · Use + / − to approach or leave'
  };
}

// Scientific context is editorial information, never inferred from scene coordinates.
const SPACE_REGIONS = {
  'outside-milky-way': {
    en: 'Beyond the Milky Way', zh: '银河系外',
    sourceLabel: 'NASA / Hubble', sourceUrl: ANDROMEDA_SOURCE_URL
  },
  'milky-way': {
    en: 'Milky Way · Beyond the Solar System', zh: '银河系 · 太阳系外',
    sourceLabel: 'NASA', sourceUrl: 'https://science.nasa.gov/universe/galaxies/'
  },
  'solar-system': {
    en: 'Milky Way › Solar System', zh: '银河系 › 太阳系',
    sourceLabel: 'NASA', sourceUrl: 'https://science.nasa.gov/solar-system/'
  }
};

export function describeSpaceContext(name, language = 'en') {
  const locale = language === 'zh' ? 'zh' : 'en';
  const note = TARGET_NOTES.find(item => item.target === name);
  const region = SPACE_REGIONS[note?.spaceRegion];
  if (!region) return null;
  const source = note.spaceSource === 'body' ? note : region;
  return { region: note.spaceRegion, path: region[locale], reference: note[locale].spaceReference || '',
    sourceLabel: source.sourceLabel, sourceUrl: source.spaceSourceUrl || source.sourceUrl };
}

// These names describe the current observation, not a measured coordinate system.
const OBSERVATION_SCALES = {
  en: { Galactic: 'Star map', Regional: 'Region', LocalMap: 'Surroundings', LocalSystem: 'System', Surface: 'Close view' },
  zh: { Galactic: '星图', Regional: '星区', LocalMap: '邻域', LocalSystem: '系统', Surface: '近景' }
};
const EXTENDED_SCALES = {
  en: { galaxy: 'Whole galaxy', nebula: 'Cloud', comet: 'Tails', pulsar: 'Beams', blackhole: 'Accretion disk' },
  zh: { galaxy: '星系整体', nebula: '云体', comet: '彗尾', pulsar: '辐射束', blackhole: '吸积盘' }
};

export function describeObservationScale(stage, bodyKind = 'star', language = 'en', insideCloud = false) {
  const locale = language === 'zh' ? 'zh' : 'en';
  if (bodyKind === 'nebula' && insideCloud) return locale === 'zh' ? '云中' : 'Inside the cloud';
  return (stage === 'LocalSystem' && EXTENDED_SCALES[locale][bodyKind]) || OBSERVATION_SCALES[locale][stage] || stage;
}

function searchName(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function searchDestinations(destinations, query) {
  const wanted = searchName(query);
  if (!wanted) return destinations.slice();
  const candidates=destinations.map(item=>({item,names:[item.target,describeTarget(item.target,'en').name,
    describeTarget(item.target,'zh').name,...(describeTarget(item.target).aliases || [])].map(searchName)}));
  // Short complete names such as Io must remain directly findable even when
  // another target contains those letters. Partial queries still browse broadly.
  const exact=candidates.filter(({names})=>names.includes(wanted));
  return (exact.length ? exact : candidates.filter(({names})=>names.some(name=>name.includes(wanted)))).map(({item})=>item);
}

export const DESTINATION_CATEGORIES = Object.freeze(['featured', 'planet', 'dwarfplanet', 'asteroid', 'moon', 'comet', 'star', 'pulsar', 'blackhole', 'nebula', 'galaxy']);

// Classification comes from the catalog; editorial notes only choose the starting order.
export function browseDestinations(destinations, { category = 'featured', query = '', region = 'all', visibleIds = null } = {}) {
  const within = body => {
    const membership = describeSpaceContext(body.target)?.region || 'milky-way';
    return region === 'outside-milky-way' ? membership === region : region === 'milky-way' ? membership !== 'outside-milky-way' : true;
  };
  destinations = destinations.filter(within);
  const scope = DESTINATION_CATEGORIES.includes(category) ? category : 'featured';
  let source = destinations;
  if (scope !== 'featured') source = destinations.filter(body => (body.bodyKind || describeTarget(body.target).bodyKind) === scope);
  else if (!query.trim() && region === 'all' && !visibleIds) source = DESTINATIONS.map(note => destinations.find(body => body.target === note.target)).filter(Boolean);
  if (visibleIds) source = source.filter(body => visibleIds.has(body.id));
  return searchDestinations(source, query);
}
