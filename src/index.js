import CompletionProvider from './CompletionProvider'
import TabNineService from './TabNineService'

let completionAssistant = null
let provider = null
let tabnineService = null

const EXTRA_TRIGGER_CHARS = '.()'

exports.activate = function () {
  console.log('Activate TabNine extension')
  // activate extension
  // TabNine service downloads TabNine if needed and starts a TabNine process
  tabnineService = new TabNineService()
  tabnineService
    .ready()
    .then(() => {
      console.log('TabNine ready')
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
    })
    .catch((error) => {
      console.log(error)
    })
}

exports.deactivate = function () {
  console.log('Deactivate TabNine extension')
  // deactivate extension
  if (tabnineService) {
    tabnineService.destroy()
    tabnineService = null
  }
  if (completionAssistant) {
    completionAssistant.dispose()
    completionAssistant = null
  }
}
