import compareVersions from 'compare-versions'
const path = nova.path
const fs = nova.fs

const MAX_RESTARTS = 10

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
      console.log('Found no TabNine executable')
      const installScriptPath = path.join(__dirname, '..', 'dl_binaries.sh')
      if (this.prepareInstallScript(installScriptPath)) {
        this.install(installScriptPath)
      }
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
    return path.normalize(
      path.join(nova.extension.globalStoragePath, 'binaries')
    )
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

  prepareInstallScript(installScriptPath) {
    // make sure dl_binaries is executable
    if (fs.access(installScriptPath, fs.X_OK)) {
      return true
    } else {
      try {
        this.makeExecutable(installScriptPath)
        return true
      } catch (error) {
        return error
      }
    }
  }

  install(installPath) {
    const downloadProcess = new Process(installPath, {
      stdio: 'pipe',
      shell: true,
      cwd: nova.extension.globalStoragePath,
    })
    downloadProcess.start()
    console.log('Downloading TabNine...')
    downloadProcess.onDidExit(this.onDownloadExit, this)
    downloadProcess.onStderr(this.onDownloadError, this)
  }

  makeExecutable(filePath) {
    const chmod = new Process('usr/bin/env', {
      args: ['chmod', '+x', filePath],
    })
    chmod.start()
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
