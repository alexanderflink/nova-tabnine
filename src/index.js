import CompletionProvider from './CompletionProvider'

let completionAssistant = null
let provider = null

exports.activate = function () {
  // activate extension
  // register a completion provider
  provider = new CompletionProvider()
  completionAssistant = nova.assistants.registerCompletionAssistant(
    '*',
    provider
  )
}

exports.deactivate = function () {
  // deactivate extension
  if (provider) {
    provider.destroy()
    provider = null
  }
  if (completionAssistant) {
    completionAssistant.dispose()
    completionAssistant = null
  }
}
