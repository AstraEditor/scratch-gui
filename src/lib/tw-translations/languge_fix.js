// 引入 TurboWarp 的翻译系统 API
import { addTranslations } from '@turbowarp/scratch-l10n';

// bro tw的翻译有些是错误的，这里要修正一下下
addTranslations('zh-cn', {
    'tw.menuBar.settings': '设置'
});