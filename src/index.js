import CompletionProvider from './CompletionProvider'
import TabNineService from './TabNineService'

let completionAssistant = null
let provider = null
let tabnineService = null

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
      completionAssistant = nova.assistants.registerCompletionAssistant(
        '*',
        provider
      )
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
