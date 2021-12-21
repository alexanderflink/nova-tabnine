import CompletionProvider from './CompletionProvider'
import TabNineService from './TabNineService'

let completionAssistant: Disposable
let provider: CompletionProvider
let tabnineService: TabNineService

const EXTRA_TRIGGER_CHARS = '.()'

async function activate() {
  console.log('Activate TabNine extension')
  // activate extension
  // TabNine service downloads TabNine if needed and starts a TabNine process
  tabnineService = new TabNineService()
  try {
    await tabnineService.ready()
    console.log('TabNine ready')
    await tabnineService.start()
    // register a completion provider
    provider = new CompletionProvider(tabnineService)
    completionAssistant = nova.assistants.registerCompletionAssistant('*', provider, {
      triggerChars: new Charset(EXTRA_TRIGGER_CHARS).concat(
        Charset.alphanumeric,
        Charset.digits,
        Charset.letters,
        Charset.lower,
        Charset.upper,
        Charset.newlines,
        Charset.symbols,
        Charset.whitespace,
        Charset.whitespaceAndNewlines,
      ),
    })
  } catch (err) {
    console.error(err)
  }
}

function deactivate() {
  console.log('Deactivate TabNine extension')
  // deactivate extension
  if (tabnineService) {
    tabnineService.destroy()
  }
  if (completionAssistant) {
    completionAssistant.dispose()
  }
}

export { activate, deactivate }
