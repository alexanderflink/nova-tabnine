import compareVersions from 'compare-versions'
const path = nova.path
const fs = nova.fs

const MAX_RESTARTS = 100

const ARCH_PATHS = {
  x86_64: 'x86_64-apple-darwin',
  arm64: 'aarch64-apple-darwin',
}

class TabNineService {
  constructor() {
    this.numRestarts = 0
    // promise to check if ready
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })

    this.init()
  }

  async init() {
    const binaryPath = await this.getBinaryPath()
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

  async startProcess() {
    const binaryPath = await this.getBinaryPath()
    this.version = this.getVersion()
    if (binaryPath) {
      this.process = new Process(binaryPath, {
        stdio: 'pipe',
        args: ['--client=nova'],
      })
      this.reader = this.process.onStdout(this.onStdout, this)
      this.writer = this.process.stdin.getWriter()
      this.didExit = this.process.onDidExit(this.onDidExit, this)
      this.stdErr = this.process.onStderr(this.onStdErr, this)
      this.process.start()
    } else {
      console.error('Error: Could not find binary path')
    }
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
  onDidExit(e) {
    console.log('TabNine exited, trying to restart...', e)
    // process exited, try to restart
    this.restartProcess()
  }

  restartProcess() {
    if (this.numRestarts < MAX_RESTARTS) {
      console.log('restarting TabNine')
      this.startProcess()
      this.numRestarts++
      return true
    } else {
      console.log('Restarted TabNine too many times')
      return false
    }
  }

  onDownloadExit(e) {
    const version = this.getVersion()
    console.log('Successfully downloaded TabNine', version)
    this.startProcess()
    this.readyResolve()
  }

  onDownloadError(e) {
    console.log('Error while downloading TabNine! Please restart extension.', e)
    this.readyReject()
  }

  getBinaryDir() {
    return path.normalize(path.join(nova.extension.globalStoragePath, 'binaries'))
  }

  async getBinaryPath() {
    try {
      const binaryDir = this.getBinaryDir()
      const latestVersion = this.getVersion()
      const archName = await this.getArchitecture()
      const archPath = ARCH_PATHS[archName.trim()]
      const binaryName = `${archPath}/TabNine`
      const binPath = path.join(binaryDir, latestVersion, binaryName)
      if (fs.access(binPath, fs.X_OK)) {
        return binPath
      } else {
        return null
      }
    } catch (error) {
      console.log('Error:', error)
      return null
    }
  }

  getVersion() {
    const binaryDir = this.getBinaryDir()
    let latestVersion = null
    // if .active file exists, use it
    const versionFilePath = path.join(binaryDir, '.active')
    if (fs.access(versionFilePath, fs.R_OK)) {
      const versionFile = fs.open(versionFilePath)
      latestVersion = versionFile.read()
    } else {
      const versions = fs.listdir(binaryDir)
      const sortedVersions = versions.sort(compareVersions)
      latestVersion = sortedVersions[sortedVersions.length - 1]
    }

    return latestVersion
  }

  getArchitecture() {
    return new Promise((resolve, reject) => {
      const uname = new Process('usr/bin/uname', {
        args: ['-m'],
      })
      uname.start()
      uname.onStdout(resolve)
      uname.onStderr(reject)
    })
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
