import TabNineService from './TabNineService'

class CompletionProvider {
  tabNineService: TabNineService
  constructor(tabNineService: TabNineService) {
    this.tabNineService = tabNineService
  }

  async provideCompletionItems(editor: TextEditor, context: CompletionContext) {
    // get document strings
    const cursorPosition = context.position
    const document = editor.document
    // TODO: truncate text if too long

    // text before cursor
    const before = document.getTextInRange(new Range(0, cursorPosition))

    // text after cursor
    const after = document.getTextInRange(
      new Range(cursorPosition, Math.max(cursorPosition, document.length - 1)),
    )

    // construct request
    if (document.path) {
      const request = {
        Autocomplete: {
          before,
          after,
          region_includes_beginning: true,
          region_includes_end: true,
          filename: document.path,
        },
      }

      try {
        const response = await this.tabNineService.request(request)

        // we got a response from TabNine, return it as CompletionItems
        const result = JSON.parse(response) as AutocompleteResponse
        if (result.results) {
          const completionItems = result.results
            .sort((a, b) => {
              // sort completions by detail
              if (a.detail && b.detail) {
                return (parseFloat(a.detail) || 0) - (parseFloat(b.detail) || 0)
              }
              return 0
            })
            .map((item) => {
              // construct CompletionItem
              const completionItem = new CompletionItem(
                item.new_prefix + item.new_suffix,
                CompletionItemKind.Color, // no fitting kind to use
              )
              // insert completion before cursor
              completionItem.insertText = item.new_prefix
              // insert completion after cursor
              completionItem.additionalTextEdits = [
                TextEdit.insert(context.position, item.new_suffix),
              ]
              completionItem.documentation = result.user_message.join(' ')
              completionItem.detail = 'TabNine ' + (item.detail || '')
              return completionItem
            })
          return completionItems
        } else {
          throw new Error('no TabNine response')
        }
      } catch (err) {
        throw new Error(err as string)
      }
    }
    throw new Error('No document path')
  }
}

export default CompletionProvider
