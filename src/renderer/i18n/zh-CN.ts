const zhCN = {
  // Search / Command bar
  'search.placeholder': '搜索笔记、输入指令或直接记录...',
  'search.hint.keyword': '输入关键词实时过滤',
  'search.hint.category': '@ 分类筛选',
  'search.hint.ai': '/ AI 命令',
  'search.aiMode': 'AI 模式 — Enter 执行',
  'search.filtering': '实时过滤中...',

  // / commands
  'cmd.natural': '自然语言（AI 识别意图）',
  'cmd.search': '语义搜索',
  'cmd.add': '创建笔记',
  'cmd.delete': '删除笔记',
  'cmd.edit': '编辑笔记',

  // Time groups
  'time.today': '今天',
  'time.yesterday': '昨天',
  'time.thisWeek': '本周',
  'time.earlier': '更早',

  // Relative time
  'time.justNow': '刚刚',
  'time.minutesAgo': '{n}分钟前',
  'time.hoursAgo': '{n}小时前',
  'time.daysAgo': '{n}天前',
  'time.weeksAgo': '{n}周前',

  // Card footer actions
  'card.copy': '复制',
  'card.copied': '已复制',
  'card.edit': '编辑',
  'card.delete': '删除',
  'card.expand': '展开全文',
  'card.open': '打开',
  'card.copyLink': '复制链接',
  'card.reveal': '显示',
  'card.hide': '隐藏',

  // Card type labels
  'type.apikey': 'API Key',
  'type.command': 'Command',
  'type.credential': 'Credential',
  'type.bookmark': 'Bookmark',
  'type.text': 'Text',

  // Confirm / cancel
  'confirm.delete': '确认删除这条笔记？',
  'confirm.deleteCmd': '确认删除这条命令？',
  'confirm.deleteCred': '确认删除这条凭据？',
  'confirm.deleteBookmark': '确认删除这个书签？',
  'confirm.cancel': '取消',
  'confirm.ok': '确认删除',

  // Empty state
  'empty.title': '没有笔记',
  'empty.hint': '使用 ⌥Space 快速记录，或在顶部搜索框输入内容',

  // Task bar
  'task.ready': '就绪',
  'task.processing': '{n} 项处理中...',
  'task.failed': '{n} 项失败',
  'task.done': '全部完成',
  'task.count': '共 {n} 项任务',

  // Settings
  'settings.title': 'Settings',
  'settings.theme': '界面模式',
  'settings.theme.light': '浅色',
  'settings.theme.dark': '深色',
  'settings.theme.system': '跟随系统',
  'settings.language': '界面语言',
  'settings.language.zhCN': '中文',
  'settings.language.en': 'English',
  'settings.language.system': '跟随系统',

  // Alt+Space
  'quickcapture.placeholder': '输入内容，Enter 保存...',
}

export default zhCN
export type Translations = typeof zhCN
