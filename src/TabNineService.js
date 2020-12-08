import compareVersions from 'compare-versions'
const path = nova.path
const fs = nova.fs

class TabNineService {
  constructor() {
    // promise to check if ready
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })

    const binaryPath = this.getBinaryPath()
    if (binaryPath) {
      // check if TabNine is downloaded
      console.log('Found TabNine at', binaryPath)
      this.startProcess()
      this.readyResolve()
    } else {
      // couldn't find executable. Proceed to download
      // run dl_binaries.sh to download TabNine
      console.log('Found no TabNine executable')
      console.log('Downloading TabNine...')
      const dl_binaries = path.join(__dirname, '..', './dl_binaries.sh')
      // make sure dl_binaries is executable
      const chmod = new Process('usr/bin/env', {
        args: ['chmod', '+x', dl_binaries],
      })
      chmod.start()
      const downloadProcess = new Process(dl_binaries, {
        stdio: 'pipe',
        shell: true,
      })
      downloadProcess.start()
      downloadProcess.onDidExit(this.onDownloadExit, this)
      downloadProcess.onStderr(this.onDownloadError, this)
    }
  }

  ready() {
    return this.readyPromise
  }

  startProcess() {
    const binaryPath = this.getBinaryPath()
    this.version = this.getVersion()
    this.process = new Process(binaryPath, {
      stdio: 'pipe',
    })
    this.reader = this.process.onStdout(this.onStdout, this)
    this.writer = this.process.stdin.getWriter()
    // call these to resolve or reject the currently active completion
    this.didExit = this.process.onDidExit(this.onDidExit, this)
    this.stdErr = this.process.onStderr(this.onStdErr, this)
    this.process.start()
  }

  // write a request to TabNine
  write(request) {
    // write to TabNine when ready
    this.writer.ready.then(() => {
      this.writer.write(JSON.stringify({ version: this.version, request }))
      this.writer.write('\n')
    })
  }

  onStdout(e) {
    this.onResponse(e)
  }

  onResponse() {}

  onStderr(error) {}
  onDidExit() {
    // process exited, try to restart
    this.restartProcess()
  }

  restartProcess() {
    if (this.numRestarts < MAX_RESTARTS) {
      this.startProcess()
      this.numRestarts++
      return true
    } else {
      console.log('Restarted TabNine too many times')
      return false
    }
  }

  onDownloadExit() {
    const version = this.getVersion()
    console.log('Successfully downloaded TabNine', version)
    this.startProcess()
    this.readyResolve()
  }

  onDownloadError() {
    console.log('Error while download TabNine! Please restart extension.')
    this.readyReject()
  }

  getBinaryDir() {
    return path.normalize(path.join(__dirname, '..', 'binaries'))
  }

  getBinaryPath() {
    try {
      const binaryDir = this.getBinaryDir()
      const latestVersion = this.getVersion()
      const binaryName = 'x86_64-apple-darwin/TabNine'
      const binPath = path.join(binaryDir, latestVersion, binaryName)
      if (fs.access(binPath, fs.X_OK)) {
        return binPath
      } else {
        return null
      }
    } catch (error) {
      console.log(error)
      return null
    }
  }

  getVersion() {
    const binaryDir = this.getBinaryDir()
    const versions = fs.listdir(binaryDir)
    const sortedVersions = versions.sort(compareVersions)
    const latestVersion = sortedVersions[sortedVersions.length - 1]
    return latestVersion
  }

  destroy() {
    try {
      this.reader.dispose()
      this.didExit.dispose()
      this.stdErr.dispose()
      this.process.terminate()
    } catch (error) {
      console.log(error)
    }
  }
}

export default TabNineService
