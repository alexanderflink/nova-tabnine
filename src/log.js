const fs = nova.fs

function log(message) {
  const file = fs.open(__dirname + '/../../log.txt', 'a')
  const date = new Date()
  file.write(date.toISOString() + ': ' + message + ' \n')
  file.close()
}

export default log
