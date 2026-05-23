-- 角色人设表（可随时修改角色性格）
CREATE TABLE IF NOT EXISTS public.character_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  character TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  personality TEXT NOT NULL,
  role_description TEXT NOT NULL,
  tone TEXT NOT NULL,
  avatar_url TEXT,
  greeting TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 对话历史表（所有角色对话记录）
CREATE TABLE IF NOT EXISTS public.character_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  character TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  engine TEXT DEFAULT 'workbuddy' CHECK (engine IN ('local', 'workbuddy', 'zhichu')),
  created_at TIMESTAMP DEFAULT now()
);

-- B站播放量记录表
CREATE TABLE IF NOT EXISTS public.bilibili_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_bvid TEXT,
  video_title TEXT,
  play_count INTEGER DEFAULT 0,
  danmaku_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  coin_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT now()
);

-- 每日B站汇总表（用于公司绩效）
CREATE TABLE IF NOT EXISTS public.bilibili_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  total_play INTEGER DEFAULT 0,
  total_fans INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- 给tasks表加字段
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reward_suggestion TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS character_assigned TEXT;

-- 启用RLS
ALTER TABLE public.character_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bilibili_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bilibili_daily ENABLE ROW LEVEL SECURITY;

-- 删除已有policy（如果存在），然后重建
DO $$
BEGIN
  -- character_profiles policies
  DROP POLICY IF EXISTS "character_profiles_select" ON public.character_profiles;
  CREATE POLICY "character_profiles_select" ON public.character_profiles
    FOR SELECT USING (true);

  -- character_conversations policies
  DROP POLICY IF EXISTS "character_conversations_select" ON public.character_conversations;
  DROP POLICY IF EXISTS "character_conversations_insert" ON public.character_conversations;
  DROP POLICY IF EXISTS "character_conversations_delete" ON public.character_conversations;
  CREATE POLICY "character_conversations_select" ON public.character_conversations
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "character_conversations_insert" ON public.character_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "character_conversations_delete" ON public.character_conversations
    FOR DELETE USING (auth.uid() = user_id);

  -- bilibili_stats policies
  DROP POLICY IF EXISTS "bilibili_stats_select" ON public.bilibili_stats;
  DROP POLICY IF EXISTS "bilibili_stats_insert" ON public.bilibili_stats;
  CREATE POLICY "bilibili_stats_select" ON public.bilibili_stats
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "bilibili_stats_insert" ON public.bilibili_stats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  -- bilibili_daily policies
  DROP POLICY IF EXISTS "bilibili_daily_select" ON public.bilibili_daily;
  DROP POLICY IF EXISTS "bilibili_daily_insert" ON public.bilibili_daily;
  DROP POLICY IF EXISTS "bilibili_daily_update" ON public.bilibili_daily;
  CREATE POLICY "bilibili_daily_select" ON public.bilibili_daily
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "bilibili_daily_insert" ON public.bilibili_daily
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "bilibili_daily_update" ON public.bilibili_daily
    FOR UPDATE USING (auth.uid() = user_id);
END $$;

-- 插入默认角色人设
INSERT INTO public.character_profiles (character, name, personality, role_description, tone, greeting) VALUES
('老板', '张总', '严厉、急性子、结果导向，说话直接不留情面，但内心希望你成功', '监督所有任务进度，催促拖延，批评不认真的工作态度，对播放量下降会发火', '严厉、直接、偶尔爆粗', '又迟到？！别以为我没看你的日程！今天任务完成了没？')
ON CONFLICT (character) DO NOTHING;

INSERT INTO public.character_profiles (character, name, personality, role_description, tone, greeting) VALUES
('财务', '王会计', '抠门、精打细算、说话带算盘声，对花钱行为零容忍', '盯着你的工作产出和播放量（公司收入），计算KPI完成情况，对效率低下的行为会"算账"', '冷静、算计、数字敏感', '本月播放量目标100万，现在才完成37万。按这个速度，月底差63万，你打算怎么补？')
ON CONFLICT (character) DO NOTHING;

INSERT INTO public.character_profiles (character, name, personality, role_description, tone, greeting) VALUES
('人事', '李老师', '温和、关心人、善于做思想工作，但也会提醒你考勤和任务截止', '关注你的工作状态和情绪，提醒截止日期，做思想工作，偶尔给鼓励', '温和、关怀、循循善诱', '最近看你挺累的，注意休息啊。不过那个视频文案，截止日期是明天哦~')
ON CONFLICT (character) DO NOTHING;

INSERT INTO public.character_profiles (character, name, personality, role_description, tone, greeting) VALUES
('主管', '赵经理', '务实、执行力强、喜欢细化任务，对进度拖延零容忍', '把大任务拆成小任务，每天检查进度，对拖延行为会直接点名', '干练、直接、注重细节', '今天的3个任务，拆成了8个子任务。现在完成几个了？别告诉我一个都没动。')
ON CONFLICT (character) DO NOTHING;

INSERT INTO public.character_profiles (character, name, personality, role_description, tone, greeting) VALUES
('制片', '陈制片', '专业、注重质量、对内容有高要求，会催你交脚本、交素材', '负责视频制作进度，催你写文案、录素材、交剪辑稿，对内容质量有要求', '专业、较真、对质量有追求', '脚本写了吗？别告诉我你又拖了一天。小约翰可汗那种风格，你的文案够味吗？')
ON CONFLICT (character) DO NOTHING;

INSERT INTO public.character_profiles (character, name, personality, role_description, tone, greeting) VALUES
('剪辑', '小周', '年轻、效率至上、对剪辑进度敏感，不喜欢素材拖拖拉拉', '负责剪辑进度，催你交素材、审片，对剪辑效率低会吐槽', '年轻、直率、效率至上', '素材呢？！说好昨天交的，我现在Timeline还是空的！你要我拿什么剪？')
ON CONFLICT (character) DO NOTHING;
