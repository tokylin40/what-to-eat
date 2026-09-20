window.WTE_DISHES = [
  {id:'hotpot',name:'火鍋',emoji:'🍲',category:'鍋物',spice:'mild',flavor:'rich',meal:'feast',price:'high',carb:'none',temp:'hot'},
  {id:'ramen',name:'拉麵',emoji:'🍜',category:'日式',spice:'mild',flavor:'rich',meal:'simple',price:'mid',carb:'noodle',temp:'hot'},
  {id:'bbq',name:'燒肉',emoji:'🥩',category:'燒烤',spice:'none',flavor:'rich',meal:'feast',price:'high',carb:'none',temp:'hot'},
  {id:'beef-noodle',name:'牛肉麵',emoji:'🍜',category:'台式',spice:'mild',flavor:'rich',meal:'simple',price:'mid',carb:'noodle',temp:'hot'},
  {id:'sushi',name:'壽司',emoji:'🍣',category:'日式',spice:'none',flavor:'light',meal:'simple',price:'mid',carb:'rice',temp:'cold'},
  {id:'curry',name:'咖哩飯',emoji:'🍛',category:'日式',spice:'mild',flavor:'rich',meal:'simple',price:'mid',carb:'rice',temp:'hot'},
  {id:'korean',name:'韓式料理',emoji:'🥘',category:'韓式',spice:'hot',flavor:'rich',meal:'feast',price:'mid',carb:'rice',temp:'hot'},
  {id:'pasta',name:'義大利麵',emoji:'🍝',category:'西式',spice:'none',flavor:'rich',meal:'simple',price:'mid',carb:'noodle',temp:'hot'},
  {id:'pizza',name:'披薩',emoji:'🍕',category:'西式',spice:'none',flavor:'rich',meal:'feast',price:'mid',carb:'bread',temp:'hot'},
  {id:'burger',name:'漢堡',emoji:'🍔',category:'美式',spice:'none',flavor:'rich',meal:'simple',price:'mid',carb:'bread',temp:'hot'},
  {id:'fried-chicken',name:'炸雞',emoji:'🍗',category:'炸物',spice:'mild',flavor:'rich',meal:'feast',price:'mid',carb:'none',temp:'hot'},
  {id:'bento',name:'便當',emoji:'🍱',category:'台式',spice:'none',flavor:'light',meal:'simple',price:'low',carb:'rice',temp:'hot'},
  {id:'thai',name:'泰式料理',emoji:'🌶️',category:'東南亞',spice:'hot',flavor:'rich',meal:'feast',price:'mid',carb:'rice',temp:'hot'},
  {id:'vietnamese',name:'越南料理',emoji:'🥢',category:'東南亞',spice:'mild',flavor:'light',meal:'simple',price:'low',carb:'noodle',temp:'hot'},
  {id:'xiaolongbao',name:'小籠包',emoji:'🥟',category:'中式',spice:'none',flavor:'light',meal:'simple',price:'mid',carb:'bread',temp:'hot'},
  {id:'braised-pork-rice',name:'滷肉飯',emoji:'🍚',category:'台式',spice:'none',flavor:'rich',meal:'simple',price:'low',carb:'rice',temp:'hot'},
  {id:'steak',name:'牛排',emoji:'🥩',category:'西式',spice:'none',flavor:'rich',meal:'feast',price:'high',carb:'none',temp:'hot'},
  {id:'seafood',name:'海鮮',emoji:'🦐',category:'海鮮',spice:'none',flavor:'light',meal:'feast',price:'high',carb:'none',temp:'hot'},
  {id:'vegetarian',name:'蔬食',emoji:'🥗',category:'蔬食',spice:'none',flavor:'light',meal:'simple',price:'mid',carb:'none',temp:'cold'},
  {id:'brunch',name:'早午餐',emoji:'🥞',category:'西式',spice:'none',flavor:'light',meal:'simple',price:'mid',carb:'bread',temp:'hot'},
  {id:'dumplings',name:'水餃',emoji:'🥟',category:'中式',spice:'none',flavor:'light',meal:'simple',price:'low',carb:'bread',temp:'hot'},
  {id:'tempura',name:'天婦羅',emoji:'🍤',category:'日式',spice:'none',flavor:'rich',meal:'feast',price:'high',carb:'none',temp:'hot'},
  {id:'donburi',name:'日式丼飯',emoji:'🍚',category:'日式',spice:'none',flavor:'rich',meal:'simple',price:'mid',carb:'rice',temp:'hot'},
  {id:'teppanyaki',name:'鐵板燒',emoji:'🔥',category:'燒烤',spice:'none',flavor:'rich',meal:'feast',price:'mid',carb:'rice',temp:'hot'},
  {id:'mala',name:'麻辣燙',emoji:'🌶️',category:'中式',spice:'hot',flavor:'rich',meal:'feast',price:'mid',carb:'noodle',temp:'hot'},
  {id:'chicken-rice',name:'雞肉飯',emoji:'🍗',category:'台式',spice:'none',flavor:'light',meal:'simple',price:'low',carb:'rice',temp:'hot'},
  {id:'omelet-rice',name:'蛋包飯',emoji:'🍳',category:'日式',spice:'none',flavor:'light',meal:'simple',price:'mid',carb:'rice',temp:'hot'},
  {id:'duck-rice',name:'鴨肉飯',emoji:'🦆',category:'台式',spice:'none',flavor:'rich',meal:'simple',price:'low',carb:'rice',temp:'hot'},
  {id:'fried-rice',name:'炒飯',emoji:'🍳',category:'中式',spice:'none',flavor:'rich',meal:'simple',price:'low',carb:'rice',temp:'hot'},
  {id:'udon',name:'烏龍麵',emoji:'🍜',category:'日式',spice:'none',flavor:'light',meal:'simple',price:'mid',carb:'noodle',temp:'hot'}
];

window.WTE_REGRET_LINES = [
  '你不是說都可以嗎？','你其實心裡已經有答案了吧？','那你剛剛是在玩什麼？','又反悔？','好啦，最後一次。',
  '你的胃比你誠實。','我開始懷疑問題不是晚餐。','選擇困難本人就是你。','這個結果哪裡不行？','剛剛不是你自己按的嗎？',
  '你只是想再玩一次吧？','胃：我可以。腦袋：不行。','你對晚餐的要求比對人生還高。','好，讓你再掙扎一次。','這次真的不能再怪我了。',
  '你再按，我就要開始收諮詢費了。','晚餐沒有惹你，真的。','你不是在選晚餐，你是在逃避承諾。'
];

window.WTE_HELL_QUESTIONS = [
  {q:'今晚的胃有多認真？',options:[
    {label:'隨便填飽',emoji:'🫡',prefs:{meal:'simple',price:'low'}},
    {label:'正常吃一餐',emoji:'🍽️',prefs:{meal:'simple',price:'mid'}},
    {label:'今天要吃爽',emoji:'👑',prefs:{meal:'feast',price:'high'}}]},
  {q:'嘴巴今天想被怎麼對待？',options:[
    {label:'清淡一點',emoji:'🌿',prefs:{flavor:'light',spice:'none'}},
    {label:'重口味',emoji:'💥',prefs:{flavor:'rich'}},
    {label:'辣下去',emoji:'🌶️',prefs:{spice:'hot'}}]},
  {q:'錢包現在什麼臉？',options:[
    {label:'省一下',emoji:'🪙',prefs:{price:'low'}},
    {label:'正常花',emoji:'💳',prefs:{price:'mid'}},
    {label:'今天不管',emoji:'💸',prefs:{price:'high'}}]},
  {q:'第一直覺：主食站哪邊？',options:[
    {label:'飯',emoji:'🍚',prefs:{carb:'rice'}},
    {label:'麵',emoji:'🍜',prefs:{carb:'noodle'}},
    {label:'麵包系',emoji:'🍞',prefs:{carb:'bread'}}]},
  {q:'溫度先決？',options:[
    {label:'熱呼呼',emoji:'🔥',prefs:{temp:'hot'}},
    {label:'冷冷也行',emoji:'🧊',prefs:{temp:'cold'}},
    {label:'我沒差',emoji:'🤷',prefs:{}}]},
  {q:'今天比較像哪種局？',options:[
    {label:'一個人快吃',emoji:'🏃',prefs:{meal:'simple',price:'low'}},
    {label:'慢慢吃',emoji:'😌',prefs:{meal:'simple',price:'mid'}},
    {label:'聚餐感',emoji:'🎉',prefs:{meal:'feast'}}]}
];


window.WTE_TEMPLATES = {
  all:{label:'全部隨機',emoji:'🎲',description:'什麼都不設限，直接讓命運亂入。',ids:null,wheelCount:10},
  taiwan:{label:'台式日常',emoji:'🍚',description:'熟悉、快速、台味一點。',ids:['beef-noodle','bento','braised-pork-rice','dumplings','chicken-rice','duck-rice','fried-rice','teppanyaki','xiaolongbao','hotpot'],wheelCount:8},
  noodle:{label:'麵食控',emoji:'🍜',description:'飯先退下，今天讓麵類自己打一架。',ids:['ramen','beef-noodle','pasta','vietnamese','mala','udon','korean','curry'],wheelCount:8},
  feast:{label:'聚餐大餐',emoji:'🥩',description:'不是隨便填飽，是要認真吃一餐。',ids:['hotpot','bbq','korean','pizza','steak','seafood','thai','tempura','teppanyaki','sushi'],wheelCount:10},
  budget:{label:'省錢快吃',emoji:'🪙',description:'錢包先活下來，速度跟飽足優先。',ids:['bento','braised-pork-rice','dumplings','chicken-rice','duck-rice','fried-rice','vietnamese','beef-noodle'],wheelCount:8},
  light:{label:'清爽一點',emoji:'🌿',description:'今天不想太油太重，胃想安靜一點。',ids:['sushi','vietnamese','vegetarian','brunch','xiaolongbao','chicken-rice','udon','seafood'],wheelCount:8},
  late:{label:'宵夜罪惡局',emoji:'🌙',description:'晚了，但嘴巴完全沒有要下班。',ids:['fried-chicken','mala','dumplings','burger','pizza','ramen','fried-rice','hotpot'],wheelCount:8}
};

window.WTE_GOOGLE_PLACES_KEY = window.WTE_GOOGLE_PLACES_KEY || '';
