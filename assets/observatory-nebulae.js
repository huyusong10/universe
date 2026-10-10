// Finite exploration portraits. Sources establish the named objects and broad
// structures; every display position, volume, colour and light is authored.
export const NEBULA_EXPLORATIONS = [
  {
    id:50193,name:'Trifid Nebula',aliases:['M20','Messier 20','NGC6514','三裂星云'],material:'trifid',code:160,
    offset:[1.68,-.27,2.13],color:[.95,.40,.61],accent:'#ef91bb',
    sourceUrl:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-20/',
    nextTarget:'Iris Nebula',
    en:{type:'Star-forming cloud · M20',fact:'Dark dust divides a luminous nursery',spaceReference:'Milky Way · Sagittarius',invitation:'Follow the branching dust lanes into a warm cloud, then find the cool reflection bank.',story:'The Trifid is a star-forming region whose familiar outline is divided by thick dust lanes. It combines glowing gas with dust that scatters nearby starlight. This view interprets those broad ingredients as intersecting dark channels and a separate cool bank.',nextReason:'Compare a mixed emission and reflection cloud with a reflection nebula.'},
    zh:{name:'三裂星云',type:'恒星形成云 · M20',fact:'暗尘切开明亮的恒星育儿所',spaceReference:'银河系内 · 人马座方向',invitation:'顺分支暗尘通道进入暖色云体，再寻找较冷的反射云岸。',story:'三裂星云是恒星形成区，熟悉的轮廓被厚尘带分割。它既有发光气体，也有散射附近星光的尘埃；这里将这些广义线索表达为交错暗通道和独立的冷色云岸。',nextReason:'比较混合发射与反射的云体和反射星云。'}
  },
  {
    id:50194,name:'Crescent Nebula',aliases:['NGC6888','C27','Caldwell 27','眉月星云','新月星云'],material:'crescent',code:161,
    offset:[.67,.68,-2.52],color:[.72,.80,.94],accent:'#b7ccef',
    sourceUrl:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-27/',
    nextTarget:'Bubble Nebula',
    en:{type:'Stellar-wind shell · NGC 6888',fact:'A massive star shapes a fragmented shell',spaceReference:'Milky Way · Cygnus',invitation:'Orbit the broken crescent, trace its crossing ribs and look through the open side.',story:'The Crescent Nebula surrounds a hot massive star. Its present fast wind encounters material shed earlier, forming a complex shell. Here an incomplete rim and overlapping ribs provide an artistic way to explore a wind-shaped envelope.',nextReason:'Compare a broken wind shell with the more complete Bubble Nebula.'},
    zh:{name:'眉月星云',type:'恒星风壳层 · NGC 6888',fact:'大质量恒星塑造破碎壳层',spaceReference:'银河系内 · 天鹅座方向',invitation:'环视残缺的眉月形边缘，沿交叉肋带观察，透过开放一侧回望。',story:'眉月星云围绕炽热的大质量恒星，较快的恒星风遇上较早释放的物质，形成复杂壳层。这里用不完整亮缘与交叠肋带，艺术化表达恒星风塑造的包层。',nextReason:'比较破碎风壳与气泡星云较完整的外壳。'}
  },
  {
    id:50195,name:'Tarantula Nebula',aliases:['30 Doradus','NGC2070','蜘蛛星云'],material:'tarantula',code:162,
    offset:[-4.1,-.73,3.7],color:[.88,.67,.46],accent:'#dfb18a',region:'outside-milky-way',
    sourceUrl:'https://www.esa.int/Science_Exploration/Space_Science/Webb/Webb_captures_a_cosmic_tarantula',
    nextTarget:'NGC 604',
    en:{type:'Giant stellar nursery · 30 Doradus',fact:'Dusty filaments around young stars in the Large Magellanic Cloud',spaceReference:'Large Magellanic Cloud · Beyond the Milky Way',invitation:'Enter the broad central clearing, then turn toward the layered web of cloud walls.',story:'The Tarantula is a major star-forming region in the Large Magellanic Cloud. Webb reveals young stars and intricate gas and dust around the central cluster. The layered web and clearing here interpret that complexity without reconstructing its measured three-dimensional layout.',nextReason:'Visit another giant stellar nursery in the Triangulum Galaxy.'},
    zh:{name:'蜘蛛星云',type:'巨型恒星育儿所 · 30 Doradus',fact:'大麦哲伦星系中环绕年轻恒星的尘丝',spaceReference:'大麦哲伦星系 · 银河系外',invitation:'进入宽阔中央空地，再转向层层交错的网状云壁。',story:'蜘蛛星云位于大麦哲伦星系，是重要的恒星形成区。韦布揭示年轻恒星及中央星团周围复杂的气尘；这里的分层云网与空地是对这些线索的表达，没有重建实测三维分布。',nextReason:'拜访三角座星系中的另一座巨型恒星育儿所。'}
  },
  {
    id:50196,name:'NGC 3603',aliases:['NGC3603','NGC 3603 Nebula'],material:'clustercliff',code:163,
    offset:[-1.15,.38,3.21],color:[.96,.73,.43],accent:'#f0c27f',
    sourceUrl:'https://science.nasa.gov/asset/hubble/star-forming-nebula-ngc-3603/',
    nextTarget:'NGC 602',
    en:{type:'Young cluster and surrounding nebula',fact:'Hot stars clear a cavity in their birth cloud',spaceReference:'Milky Way · Carina arm',invitation:'Pass the open cluster into a scalloped cloud wall and inspect the pillars along its edge.',story:'NGC 3603 contains a rich young cluster surrounded by its birth material. Ultraviolet radiation and winds from hot stars have cleared a cavity, exposing gas and dusty pillars. This portrait concentrates on that relationship between an open centre and an eroded cloud wall.',nextReason:'Compare two young clusters and their surrounding cloud boundaries.'},
    zh:{name:'NGC 3603',type:'年轻星团与周围星云',fact:'炽热恒星在诞生云中清出空腔',spaceReference:'银河系内 · 船底座旋臂',invitation:'从开放星团进入起伏云壁，检查边缘的尘柱。',story:'NGC 3603 包含丰富的年轻星团和周围诞生物质。炽热恒星的紫外辐射与恒星风清出空腔，显露气体与暗尘柱；此处着重表达开放中心和受侵蚀云壁之间的关系。',nextReason:'比较两座年轻星团和周围不同的云体边界。'}
  },
  {
    id:50197,name:'NGC 602',aliases:['NGC602','N90','N 90'],material:'wingcavity',code:164,
    offset:[-4.72,-.51,2.94],color:[.85,.61,.88],accent:'#d69edc',region:'outside-milky-way',
    sourceUrl:'https://esawebb.org/images/weic2425a/',
    nextTarget:'NGC 3603',
    en:{type:'Young cluster and star-forming cloud',fact:'A young cluster near the Small Magellanic Cloud’s outskirts',spaceReference:'Small Magellanic Cloud · Beyond the Milky Way',invitation:'Trace the open arch around the cluster, then inspect its hanging dusty fingers.',story:'NGC 602 lies near the outskirts of the Small Magellanic Cloud. Dense dusty clouds and ionised gas surround its young cluster. The open arch, fingers and sparse central lights here interpret a star-forming environment in another galaxy.',nextReason:'Return to a massive cluster inside our own galaxy.'},
    zh:{name:'NGC 602',type:'年轻星团与恒星形成云',fact:'小麦哲伦星系外围的年轻星团',spaceReference:'小麦哲伦星系 · 银河系外',invitation:'沿星团周围的开放拱岸环视，再检查垂落的暗尘指状结构。',story:'NGC 602 位于小麦哲伦星系外围，年轻星团周围有致密暗尘云与电离气体。这里的开放拱岸、指状云体和稀疏中央亮点，是对另一座星系中恒星形成环境的解释。',nextReason:'回到银河系内的大质量年轻星团。'}
  },
  {
    id:50198,name:'NGC 604',aliases:['NGC604','NGC 604 Nebula'],material:'multicavity',code:165,
    offset:[-3.84,.92,-3.51],color:[.91,.49,.33],accent:'#e99170',region:'outside-milky-way',
    sourceUrl:'https://science.nasa.gov/asset/webb/ngc-604-nircam-image/',
    nextTarget:'Triangulum Galaxy',
    en:{type:'Giant star-forming region in M33',fact:'Young stars carve multiple cavities in gas and dust',spaceReference:'Triangulum Galaxy · Beyond the Milky Way',invitation:'Move between unequal cavities and follow the thick bridges that divide them.',story:'NGC 604 is a giant star-forming region in the Triangulum Galaxy. Webb shows cavities carved by winds from bright young stars, with clumpy clouds along their edges. Unequal chambers and linking cloud bridges make those broad features explorable here.',nextReason:'Withdraw to the galaxy that contains this stellar nursery.'},
    zh:{name:'NGC 604',type:'M33 内的巨型恒星形成区',fact:'年轻恒星在气尘中开出多个空腔',spaceReference:'三角座星系 · 银河系外',invitation:'在大小不一的空腔之间移动，沿分隔它们的厚云桥观察。',story:'NGC 604 是三角座星系中的巨型恒星形成区。韦布揭示明亮年轻恒星的风开出的空腔，以及边缘团状云体；这里用不等大的空间和连接云桥，让这些广义特征可被探索。',nextReason:'退离，观察容纳这座恒星育儿所的星系。'}
  },
  {
    id:50199,name:'Iris Nebula',aliases:['NGC7023','C4','Caldwell 4','鸢尾花星云'],material:'iris',code:166,
    offset:[-.43,.84,-3.06],color:[.42,.62,.96],accent:'#8faeea',
    sourceUrl:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-4/',
    nextTarget:'NGC 1333',
    en:{type:'Reflection nebula · NGC 7023',fact:'Dust scatters the light of a central star',spaceReference:'Milky Way · Cepheus',invitation:'Approach the cool folded banks, orbit their dark gaps and recover the central light.',story:'The Iris is a reflection nebula: dust scatters starlight rather than producing all of its visible light through hot gas emission. Its central star illuminates surrounding material. Folded cool banks and intervening dark dust here are an illustrative interpretation, not a literal flower.',nextReason:'Compare a central reflection cloud with several illuminated openings.'},
    zh:{name:'鸢尾花星云',type:'反射星云 · NGC 7023',fact:'尘埃散射中央恒星的光',spaceReference:'银河系内 · 仙王座方向',invitation:'接近冷色折叠云岸，环视暗隙，再重新找到中央亮点。',story:'鸢尾花属于反射星云，尘埃散射恒星光，并非所有可见光都来自热气体发射。中央恒星照亮周围物质；此处的冷色折叠云岸与间隔暗尘是示意，并不是字面的花朵。',nextReason:'比较中央反射云与多个被照亮的开口。'}
  },
  {
    id:50200,name:'NGC 1333',aliases:['NGC1333','Perseus stellar nursery'],material:'reflectionknots',code:167,
    offset:[-2.51,.41,-1.27],color:[.62,.69,.94],accent:'#a2b6e6',
    sourceUrl:'https://science.nasa.gov/asset/hubble/ngc-1333/',
    nextTarget:'Ghost Nebula',
    en:{type:'Dusty star-forming reflection cloud',fact:'New stars illuminate openings in a dark molecular cloud',spaceReference:'Milky Way · Perseus molecular cloud',invitation:'Compare the blue upper opening, amber window and deeper red cloud among the dust.',story:'NGC 1333 lies in the Perseus molecular cloud. Young stars illuminate dusty material, while much of the star formation remains hidden. Hubble reveals scattered blue light, obscured stars and red emission from jets. The separated windows here express these different views through dust.',nextReason:'Compare embedded young-star illumination with an externally lit cloud.'},
    zh:{name:'NGC 1333',type:'含尘恒星形成与反射云',fact:'新生恒星照亮暗分子云中的开口',spaceReference:'银河系内 · 英仙座分子云',invitation:'比较暗尘之间的蓝色上层开口、琥珀色窗口与深处红云。',story:'NGC 1333 位于英仙座分子云，年轻恒星照亮含尘物质，大量恒星形成活动仍被遮蔽。哈勃揭示散射蓝光、被遮挡恒星和喷流相关红色辐射；这里分开的窗口表达透过暗尘的不同视野。',nextReason:'比较内部年轻恒星照明与外部恒星照亮的云。'}
  },
  {
    id:50201,name:'Ghost Nebula',aliases:['IC63','IC 63','Ghost of Cassiopeia','仙后座幽灵','幽灵星云'],material:'ghostcloud',code:168,
    offset:[.15,.96,-2.73],color:[.90,.45,.56],accent:'#e79bb7',
    sourceUrl:'https://esahubble.org/images/heic1818a/',
    nextTarget:'Cone Nebula',
    en:{type:'Reflection and emission cloud · IC 63',fact:'Radiation from Gamma Cassiopeiae erodes a nearby cloud',spaceReference:'Milky Way · Cassiopeia',invitation:'Follow the bright swept edge into trailing cloud folds; find the open side facing its light.',story:'IC 63 reflects nearby Gamma Cassiopeiae’s light and emits hydrogen radiation under its ultraviolet illumination. That radiation also erodes the cloud. The swept edge and trailing folds here interpret external illumination; no invented central star is placed inside the cloud.',nextReason:'Compare a swept cloud edge with a dense dust pillar.'},
    zh:{name:'幽灵星云',type:'反射与发射云 · IC 63',fact:'仙后座 γ 的辐射侵蚀附近云体',spaceReference:'银河系内 · 仙后座方向',invitation:'沿被扫亮的边缘进入后方云褶，寻找朝向光源的开放一侧。',story:'IC 63 反射附近仙后座 γ 的星光，也在其紫外照明下发出氢辐射，云体同时被侵蚀。这里用扫亮前缘和拖曳云褶解释外部照明，不在云中虚构中央恒星。',nextReason:'比较被扫亮的云缘与致密暗尘柱。'}
  },
  {
    id:50202,name:'Cone Nebula',aliases:['NGC2264 Cone','Cone','锥状星云'],material:'conepillar',code:169,
    offset:[-2.05,-.36,-1.78],color:[.91,.38,.34],accent:'#e88d83',
    sourceUrl:'https://science.nasa.gov/image-article/apod-2024-february-4-the-cone-nebula-from-hubble/',
    nextTarget:'Eagle Nebula',
    en:{type:'Dust pillar within NGC 2264',fact:'A dense pillar stands against glowing gas',spaceReference:'Milky Way · Monoceros',invitation:'Circle the tapered dark pillar and approach the illuminated, uneven head.',story:'The Cone is a prominent pillar in the star-forming region NGC 2264. Dense dust and cold gas stand against a reddish veil of dust and glowing hydrogen. Its windswept head and taper here are a volumetric illustration of that broad shape, not measured terrain.',nextReason:'Compare a solitary taper with a group of dusty pillars.'},
    zh:{name:'锥状星云',type:'NGC 2264 内的暗尘柱',fact:'致密柱体映在发光气体前方',spaceReference:'银河系内 · 麒麟座方向',invitation:'绕过渐细暗柱，接近受照且不平整的柱头。',story:'锥状星云是 NGC 2264 恒星形成区中的显著尘柱，致密暗尘与冷气体映在红色尘幕和发光氢气前。此处受风侵蚀的柱头与锥形，是广义外形的体积示意，并不是测量地形。',nextReason:'比较单独锥柱与成组暗尘柱。'}
  },
  {
    id:50203,name:'Red Rectangle',aliases:['HD44179','HD 44179','Red Rectangle Nebula','红矩形星云'],material:'redrectangle',code:170,
    offset:[-.94,-.39,-2.14],color:[.96,.48,.24],accent:'#edaa74',
    sourceUrl:'https://esahubble.org/news/heic0408/',
    nextTarget:'Boomerang Nebula',
    en:{type:'Bipolar outflow · HD 44179',fact:'An X-shaped structure with ladder-like bands',spaceReference:'Milky Way · Monoceros',invitation:'Orbit the open X-shaped walls and inspect the separated rungs across each lobe.',story:'Hubble resolves the Red Rectangle into an X-shaped structure interpreted as outflowing gas and dust, with ladder-like features. The view here uses open conical walls and interrupted rungs to explore that geometry. It is not a solid box or a mapped three-dimensional reconstruction.',nextReason:'Compare structured warm outflows with a cooler-looking bipolar envelope.'},
    zh:{name:'红矩形星云',type:'双极外流 · HD 44179',fact:'X 形结构中分布梯状亮带',spaceReference:'银河系内 · 麒麟座方向',invitation:'环视开放 X 形云壁，检查横跨两侧亮瓣的间断梯带。',story:'哈勃将红矩形分辨为 X 形结构，被解释为向外流动的气尘，并显露梯状细节。这里用开放锥壁与间断梯带探索这种几何，它不是实心盒子，也不是测绘出的三维重建。',nextReason:'比较有层次的暖色外流与较冷色的双极包层。'}
  },
  {
    id:50204,name:'Boomerang Nebula',aliases:['Boomerang','回力棒星云'],material:'boomerang',code:171,
    offset:[-1.43,.22,2.67],color:[.47,.72,.96],accent:'#91c0ee',
    sourceUrl:'https://science.nasa.gov/photojournal/ghostly-boomerang/',
    nextTarget:'Red Rectangle',
    en:{type:'Cold outflow and bipolar reflection nebula',fact:'Visible and millimetre observations reveal different envelopes',spaceReference:'Milky Way · Centaurus',invitation:'Follow the narrow waist into unequal blue lobes, then withdraw to see the faint outer envelope.',story:'Hubble shows a narrow-waisted double-lobed reflection nebula, while ALMA reveals a more extended cold gas envelope. The cool lobes and much fainter outer volume here interpret those different tracers. Colour is illustrative and does not display a measured temperature map.',nextReason:'Compare two outflow envelopes with very different visible structures.'},
    zh:{name:'回力棒星云',type:'冷外流与双极反射星云',fact:'可见光和毫米波揭示不同的包层',spaceReference:'银河系内 · 半人马座方向',invitation:'从狭窄腰部进入大小不同的蓝色亮瓣，再退离辨认较淡外包层。',story:'哈勃显示窄腰双瓣反射星云，ALMA 则揭示更延伸的冷气体包层。这里的冷色亮瓣与较淡外层解释这些不同示踪线索，颜色属于示意，没有展示实测温度地图。',nextReason:'比较两种可见结构很不相同的外流包层。'}
  }
];
