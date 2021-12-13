class CompletionProvider {
  constructor(tabnineService) {
    this.tabnineService = tabnineService
    tabnineService.onResponse = this.onResponse.bind(this)
    this.resolve = null
    this.reject = null
    this.currentCompletionContext = null
  }

  provideCompletionItems(editor, context) {
    this.currentCompletionContext = context
    const promise = new Promise((res, rej) => {
      this.resolve = res
      this.reject = rej
    })

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
    const request = {
      Autocomplete: {
        before,
        after,
        region_includes_beginning: true,
        region_includes_end: true,
        filename: document.path,
      },
    }

    this.tabnineService.write(request)
    return promise
  }

  onResponse(response) {
    // we got a response from TabNine, return it as CompletionItems
    const result = JSON.parse(response)
    if (result.results) {
      const completionItems = result.results
        .sort(
          (a, b) =>
            // sort completions by detail
            (parseFloat(a.detail) || 0) - (parseFloat(b.detail) || 0),
        )
        .map((item) => {
          const completionItem = new CompletionItem(
            item.new_prefix + item.new_suffix,
            CompletionItemKind.Color, // no fitting kind to use
          )
          // insert completion before cursor
          completionItem.insertText = item.new_prefix
          // insert completion after cursor
          completionItem.additionalTextEdits = [
            TextEdit.insert(this.currentCompletionContext.position, item.new_suffix),
          ]
          completionItem.documentation = result.user_message.join(' ')
          completionItem.detail = 'TabNine ' + (item.detail || '')
          return completionItem
        })
      this.resolve(completionItems)
    } else {
      this.reject(new Error('No TabNine response'))
    }
  }
}

export default CompletionProvider
