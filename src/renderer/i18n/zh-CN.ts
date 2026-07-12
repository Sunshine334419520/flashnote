const zhCN = {
  // Search / Command bar
  'search.placeholder': '搜索笔记、输入指令或直接记录...',
  'search.hint.keyword': '输入关键词实时过滤',
  'search.hint.category': '@ 分类筛选',
  'search.hint.ai': '/ AI 命令',
  'search.aiMode': 'AI 模式 — Enter 执行',
  'search.filtering': '实时过滤中...',
  'search.processing': 'AI 处理中',
  'search.abort': '终止',
  'search.noResults': '没有匹配的笔记',
  'search.resultCount': '{n} 条结果',
  'search.clear': '清除',
  'search.noProvider': '未配置 AI，请在设置中添加服务商',
  'search.noTarget': '未找到匹配的笔记',
  'search.failed': 'AI 处理失败，请重试',
  'search.retry': '重试',

  // Command confirmation panel
  'cmdpanel.deleteTitle': '确认删除以下笔记',
  'cmdpanel.editTitle': '确认修改',
  'cmdpanel.delete': '删除 {n} 项',
  'cmdpanel.apply': '应用修改',
  'cmdpanel.cancel': '取消',
  'cmdpanel.fieldTitle': '标题',
  'cmdpanel.fieldContent': '内容',
  'cmdpanel.fieldTags': '标签',
  'cmdpanel.fieldCategory': '分类',

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
  'card.save': '保存',
  'card.copy': '复制',
  'card.copied': '已复制',
  'card.edit': '编辑',
  'card.delete': '删除',
  'card.copyFull': '复制全文',
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
  'settings.title': '设置',
  'settings.theme': '界面模式',
  'settings.theme.light': '浅色',
  'settings.theme.dark': '深色',
  'settings.theme.system': '跟随系统',
  'settings.language': '界面语言',
  'settings.language.zhCN': '中文',
  'settings.language.en': 'English',
  'settings.language.system': '跟随系统',

  // AI Provider settings
  'provider.title': 'AI 服务商',
  'provider.subtitle': '配置用于笔记自动分类的 AI 模型',
  'provider.add': '添加服务商',
  'provider.empty.title': '未配置 AI 服务商',
  'provider.empty.hint': '添加一个服务商以启用笔记自动分类',
  'provider.active': '使用中',
  'provider.setActive': '设为使用中',
  'provider.test': '测试',
  'provider.testing': '测试中...',
  'provider.test.success': '连接成功！',
  'provider.test.fail': '连接失败 — 请检查 API Key 和网络',
  'provider.test.error': '连接出错：',
  'provider.edit': '编辑',
  'provider.delete': '删除',
  'provider.field.model': '模型',
  'provider.field.apiKey': 'API Key',
  'provider.field.endpoint': '接口地址',

  // Provider form
  'provider.form.addTitle': '添加服务商',
  'provider.form.editTitle': '编辑服务商',
  'provider.form.type': '服务商类型',
  'provider.form.name': '显示名称',
  'provider.form.namePlaceholder': '例如「我的 DeepSeek」',
  'provider.form.apiKey': 'API Key',
  'provider.form.apiKeyUnchanged': '（保持不变）',
  'provider.form.baseURL': '接口地址',
  'provider.form.model': '模型',
  'provider.form.maxTokens': '最大 Token',
  'provider.form.thinking': '深度思考模式',
  'provider.form.thinkingHint': '启用 DeepSeek 推理链，分类更准确但响应更慢',
  'provider.form.cancel': '取消',
  'provider.form.save': '保存修改',

  'quickcapture.hint.search': '输入搜索',
  'quickcapture.hint.category': '@ 分类',
  'quickcapture.hint.ai': 'Enter ↵ AI 搜索 / 创建',
  'quickcapture.hint.navigate': 'Enter ↵ 执行 · ↑↓ 导航 · Esc 清除',
  'quickcapture.placeholder': '输入内容，Enter 保存...',
  'quickcapture.created': '笔记已创建',
}

export default zhCN
export type Translations = typeof zhCN
