import CompletionProvider from './CompletionProvider'

let completionAssistant = null
let provider = null

exports.activate = function () {
  console.log('activate')
  // activate extension
  // register a completion provider
  provider = new CompletionProvider()
  completionAssistant = nova.assistants.registerCompletionAssistant(
    '*',
    provider
  )
}

exports.deactivate = function () {
  console.log('deactivate')
  // deactivate extension
  completionAssistant.dispose()
  provider.destroy()
}