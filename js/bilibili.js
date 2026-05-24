/**
 * B站API模块 - WBI签名认证
 * 用于获取播放量、粉丝数等数据
 */

// ===== WBI签名算法 =====

let wbi密钥缓存 = null;
let wbi密钥时间 = 0;
const WBI缓存时间 = 10 * 60 * 1000; // 10分钟缓存

/** 获取WBI签名密钥对（imgKey + subKey） */
async function 获取WBI密钥() {
  const 现在 = Date.now();
  if (wbi密钥缓存 && (现在 - wbi密钥时间) < WBI缓存时间) {
    return wbi密钥缓存;
  }

  const 响应 = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    credentials: 'include',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com'
    }
  });

  const 数据 = await 响应.json();

  if (!数据.data || !数据.data.wbi_img || !数据.data.wbi_sub) {
    // 未登录也能获取公开的wbi密钥（部分接口需要登录才能获取）
    // 尝试使用默认密钥或从其他接口获取
    console.warn('获取WBI密钥失败，尝试使用公开接口');
    // 使用从B站主页获取的默认密钥（可能会过期）
    return {
      imgKey: '653657f524a54795006384bb645aac54',
      subKey: 'b6dd2083f5034e6e8b7d387a9d25b0f'
    };
  }

  const imgKey = 数据.data.wbi_img.img_url?.split('/').pop()?.split('.')[0] || '';
  const subKey = 数据.data.wbi_sub.sub_url?.split('/').pop()?.split('.')[0] || '';

  wbi密钥缓存 = { imgKey, subKey };
  wbi密钥时间 = 现在;

  return wbi密钥缓存;
}

/** WBI签名混淆表 */
const WBI混淆表 = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 9, 6, 56, 59, 34, 63, 57, 62, 11, 36, 20, 52, 21, 64, 44];

/** 计算WBI签名 */
function 计算WBI签名(参数) {
  // 获取密钥（使用缓存或默认值）
  const imgKey = wbi密钥缓存?.imgKey || '653657f524a54795006384bb645aac54';
  const subKey = wbi密钥缓存?.subKey || 'b6dd2083f5034e6e8b7d387a9d25b0f';

  // 合并密钥
  const 混合密钥 = imgKey + subKey;

  // 按照混淆表生成32位密钥
  let 混淆后密钥 = '';
  for (let i = 0; i < 32; i++) {
    if (WBI混淆表[i] < 混合密钥.length) {
      混淆后密钥 += 混合密钥[WBI混淆表[i]];
    }
  }

  // 添加时间戳
  const wts = Math.floor(Date.now() / 1000);
  参数.wts = wts;

  // 参数按照key排序
  const 排序Keys = Object.keys(参数).sort();
  let 参数字符串 = '';
  for (const key of 排序Keys) {
    // 过滤掉!'\()*的特殊字符
    const value = String(参数[key]).replace(/[!'()*]/g, '');
    参数字符串 += `${key}=${value}&`;
  }
  参数字符串 = 参数字符串.slice(0, -1); // 去掉最后一个&

  // 计算签名: MD5(参数字符串 + 混淆后密钥)
  const 签名串 = 参数字符串 + 混淆后密钥;
  const 签名 = MD5(签名串);

  return { ...参数, w_rid: 签名 };
}

// ===== B站API调用 =====

/** 获取用户投稿视频列表（需要WBI签名） */
async function 获取用户视频列表(UID, 页码 = 1, 每页 = 20) {
  // 先确保有WBI密钥
  await 获取WBI密钥();

  const 参数 = {
    mid: UID,
    ps: 每页,
    pn: 页码,
    order: 'pubdate',
    dm_rm: 0,
  };

  const 签名参数 = 计算WBI签名(参数);

  const 查询串 = new URLSearchParams(签名参数).toString();
  const 响应 = await fetch(`https://api.bilibili.com/x/space/wbi/arc/search?${查询串}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://space.bilibili.com',
    }
  });

  const 数据 = await 响应.json();
  if (数据.code !== 0) {
    throw new Error('获取视频列表失败：' + (数据.message || '未知错误'));
  }

  return 数据.data;
}

/** 获取UP主基本信息（无需WBI签名） */
async function 获取用户信息(UID) {
  const 响应 = await fetch(`https://api.bilibili.com/x/space/acc/info?mid=${UID}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://space.bilibili.com',
    }
  });

  const 数据 = await 响应.json();
  if (数据.code !== 0) {
    throw new Error('获取用户信息失败：' + 数据.message);
  }

  return {
    uid: 数据.data.mid,
    name: 数据.data.name,
    face: 数据.data.face,
    sign: 数据.data.sign,
    follower: 数据.data.follower,
    following: 数据.data.following,
    video: 数据.data.video,
  };
}

/** 获取UP主粉丝数（无需WBI签名） */
async function 获取粉丝数(UID) {
  const 响应 = await fetch(`https://api.bilibili.com/x/relation/stat?vmid=${UID}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://space.bilibili.com',
    }
  });

  const 数据 = await 响应.json();
  if (数据.code !== 0) {
    return 0;
  }

  return 数据.data.follower;
}

/** 获取单个视频的详细统计（无需WBI签名） */
async function 获取视频统计(BVID) {
  const 响应 = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${BVID}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com',
    }
  });

  const 数据 = await 响应.json();
  if (数据.code !== 0) {
    return null;
  }

  const s = 数据.data.stat;
  return {
    aid: 数据.data.aid,
    bvid: 数据.data.bvid,
    title: 数据.data.title,
    play: s.view,
    danmaku: s.danmaku,
    reply: s.reply,
    favorite: s.favorite,
    coin: s.coin,
    share: s.share,
    like: s.like,
  };
}

// ===== 数据抓取与存储 =====

const 用户UID = 1954814960; // 用户的B站UID

/** 抓取并存储用户的B站数据到Supabase */
async function 抓取用户B站数据() {
  try {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    if (!userId) throw new Error('未登录');

    console.log('开始抓取B站数据...');

    // 获取用户信息
    const 用户信息 = await 获取用户信息(用户UID);
    console.log('用户信息：', 用户信息.name);

    // 获取粉丝数
    const 粉丝数 = await 获取粉丝数(用户UID);
    console.log('粉丝数：', 粉丝数);

    // 获取视频列表（最新20个）
    let 视频列表 = [];
    try {
      const 视频数据 = await 获取用户视频列表(用户UID, 1, 20);
      视频列表 = 视频数据.list?.vlist || [];
    } catch (e) {
      console.warn('获取视频列表失败（可能需要登录）：', e.message);
      // 如果获取视频列表失败，只保存基本信息
    }

    // 计算总播放量
    let 总播放量 = 0;
    const 视频记录 = [];

    for (const 视频 of 视频列表.slice(0, 10)) { // 只取最新10个视频
      总播放量 += 视频.play || 0;
      视频记录.push({
        bvid: 视频.bvid,
        title: 视频.title,
        play: 视频.play || 0,
        danmaku: 视频.video_review || 0,
        reply: 视频.review || 0,
        favorite: 视频.favorites || 0,
        coin: 0,
        share: 0,
        like: 视频.like || 0,
        published_at: new Date(视频.created * 1000).toISOString(),
      });
    }

    // 准备存储的数据
    const 记录 = {
      user_id: userId,
      uid: 用户UID,
      name: 用户信息.name,
      follower: 粉丝数 || 用户信息.follower || 0,
      total_play: 总播放量,
      video_count: 视频列表.length || 用户信息.video || 0,
      videos: 视频记录,
      fetched_at: new Date().toISOString(),
    };

    console.log('准备存储数据：', 记录);

    // 先删除旧记录
    await supabaseClient.from('bilibili_stats')
      .delete()
      .eq('user_id', userId);

    // 插入新记录
    const { data, error } = await supabaseClient.from('bilibili_stats')
      .insert(记录)
      .select()
      .single();

    if (error) {
      console.error('存储B站数据失败：', error);
      throw new Error(error.message);
    }

    console.log('B站数据抓取并存储成功：', data);
    显示Toast('B站数据已更新');
    return 记录;

  } catch (e) {
    console.error('B站数据抓取失败：', e);
    显示Toast('B站数据抓取失败：' + e.message);
    throw e;
  }
}

/** 搜索UP主获取UID */
async function 搜索UP主(关键词) {
  const 响应 = await fetch(`https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(关键词)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://search.bilibili.com',
    }
  });

  const 数据 = await 响应.json();
  if (数据.code !== 0 || !数据.data?.result?.[0]) {
    return null;
  }

  return {
    uid: 数据.data.result[0].mid,
    name: 数据.data.result[0].uname,
    face: 数据.data.result[0].upic,
    fans: 数据.data.result[0].fans,
  };
}

/** 抓取竞争对手数据 */
async function 抓取竞争对手数据() {
  const 竞争对手 = [
    { name: '卢客问', keyword: '卢克文' },
    { name: '弓手东廊', keyword: '弓手冬郎' },
    { name: '勇敢得泳', keyword: '勇敢De永' },
    { name: '瑞画散国', keyword: '睿画三国' },
    { name: '刮籽加可勒', keyword: '瓜子加可乐' },
  ];

  const 结果 = [];

  for (const 对手 of 竞争对手) {
    try {
      const 信息 = await 搜索UP主(对手.keyword);
      if (信息) {
        结果.push({
          name: 对手.name,
          uid: 信息.uid,
          fans: 信息.fans || 0,
        });
      }
    } catch (e) {
      console.warn(`获取${对手.name}数据失败：`, e);
    }
  }

  return 结果;
}

/** 定时抓取（每小时一次） */
let 抓取定时器 = null;

function 启动B站数据定时抓取() {
  if (抓取定时器) clearInterval(抓取定时器);

  // 首次立即执行
  抓取用户B站数据().catch(e => console.error('首次抓取失败：', e));

  // 每小时抓取一次
  抓取定时器 = setInterval(() => {
    抓取用户B站数据().catch(e => console.error('定时抓取失败：', e));
  }, 60 * 60 * 1000);

  console.log('B站数据定时抓取已启动');
}

// ===== 导出 =====

const B站API = {
  获取用户信息,
  获取粉丝数,
  获取用户视频列表,
  获取视频统计,
  抓取用户B站数据,
  启动B站数据定时抓取,
  搜索UP主,
  抓取竞争对手数据,
  用户UID,
};
