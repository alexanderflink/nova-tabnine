import compareVersions from 'compare-versions'
const path = nova.path
const fs = nova.fs

const MAX_RESTARTS = 10
const REQUEST_TIMEOUT = 1000

const ARCH_PATHS: Record<string, string> = {
  x86_64: 'x86_64-apple-darwin',
  arm64: 'aarch64-apple-darwin',
}

class TabNineService {
  numRestarts = 0
  version?: string | null = null
  process?: Process
  reader?: Disposable
  didExit?: Disposable
  stdErr?: Disposable
  callbackQueue: { (line: string): void }[] = []

  async init() {
    // get binary
    const [binaryPath, error] = await this.getBinaryPath()
    if (binaryPath) {
      console.log('Found TabNine at', binaryPath)
      return true
    } else if (error) {
      // could not get binary, proceed to download
      await this.install()
      const [binaryPath, error] = await this.getBinaryPath()

      if (binaryPath) {
        console.log('Successfully installed TabNine')
        return true
      } else if (error) {
        throw error
      }
    }

    throw new Error('Could not start or install TabNine. Please restart extension')
  }

  async start() {
    const [binaryPath] = await this.getBinaryPath()
    if (binaryPath) {
      try {
        this.startProcess(binaryPath)
      } catch (error) {
        await this.restartProcess()
      }
    }
  }

  async ready() {
    await this.init()
    return true
  }

  startProcess(binaryPath: string) {
    this.version = this.getVersion()

    if (binaryPath) {
      this.process = new Process(binaryPath, {
        stdio: 'pipe',
        args: ['--client=nova', '--no-lsp=true'],
      })

      this.reader = this.process.onStdout(this.onStdout.bind(this))

      this.didExit = this.process.onDidExit(this.onDidExit.bind(this))
      this.stdErr = this.process.onStderr(this.onStderr.bind(this))

      this.process.start()
      console.log('Starting TabNine process')
    } else {
      throw new Error('Could not find binary path')
    }
  }

  request(content: AutoCompleteRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.process?.stdin) {
        const writableStream = this.process.stdin as WritableStream<string>
        const writer = writableStream.getWriter()

        const releaseTimeout = setTimeout(() => {
          console.log('Writer timed out')
          try {
            writer.releaseLock()
          } catch (err) {
            console.log(err)
          }
        }, REQUEST_TIMEOUT)

        this.onReadOnce(resolve)

        writer?.ready
          .then(() => {
            return writer?.write(JSON.stringify({ version: this.version, request: content }) + '\n')
          })
          .then(() => {
            clearTimeout(releaseTimeout)
            writer.releaseLock()
          })
          .catch(console.error)
      } else {
        reject('No process running')
      }
    })
  }

  onReadOnce(callback: (line: string) => void) {
    this.callbackQueue.push(callback)
  }

  onStdout(line: string) {
    const oldestCallback = this.callbackQueue.shift()

    if (!oldestCallback) {
      throw new Error('Read a response from the engine before a request was written.')
    }

    oldestCallback(line)
  }

  onStderr(line: string) {
    console.error(line)
  }

  onDidExit(status: number) {
    console.log('TabNine exited with status code: ', status)
    // process exited, try to restart
    this.restartProcess().catch(console.error)
  }

  async restartProcess() {
    if (this.numRestarts < MAX_RESTARTS) {
      console.log('restarting TabNine')
      const [binaryPath, error] = await this.getBinaryPath()

      if (binaryPath) {
        try {
          this.startProcess(binaryPath)
          this.numRestarts++
          return true
        } catch {
          await this.restartProcess()
        }
      } else if (error) {
        throw error
      }
      return false
    } else {
      console.log('Restarted TabNine too many times')
      return false
    }
  }

  getBinaryDir() {
    return path.normalize(path.join(nova.extension.globalStoragePath, 'binaries'))
  }

  async getBinaryPath(): Promise<[string | null, Error | null]> {
    let result: string | null = null
    let error: Error | null = null
    try {
      const binaryDir = this.getBinaryDir()
      const latestVersion = this.getVersion()
      if (latestVersion) {
        const archName = await this.getArchitecture()
        const archPath = ARCH_PATHS[archName.trim()] ?? ARCH_PATHS['x86_64']
        const binaryName = `${archPath}/TabNine`
        const binaryPath = path.join(binaryDir, latestVersion, binaryName)
        if (fs.access(binaryPath, fs.X_OK)) {
          result = binaryPath
        } else {
          error = new Error('Binary not executable')
        }
      } else {
        error = new Error('Could not find a version of TabNine')
      }
    } catch (err) {
      error = new Error(err as string)
    }

    return [result, error]
  }

  getVersion(): string | null {
    const binaryDir = this.getBinaryDir()
    let latestVersion: string | null = null
    // if .active file exists, use it
    const versionFilePath = path.join(binaryDir, '.active')
    if (fs.access(versionFilePath, fs.R_OK)) {
      const versionFile = fs.open(versionFilePath) as FileTextMode
      latestVersion = versionFile.read()
    } else {
      const versions = fs.listdir(binaryDir)
      const sortedVersions = versions.sort(compareVersions)
      latestVersion = sortedVersions[sortedVersions.length - 1]
    }

    return latestVersion
  }

  getArchitecture(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const uname = new Process('usr/bin/uname', {
        args: ['-m'],
      })
      uname.start()
      uname.onStdout((line: string) => resolve(line.trim()))
      uname.onStderr(reject)
    })
  }

  async install() {
    // get version from remote
    const binaryDir = this.getBinaryDir()
    const remoteVersion = await this.getVersionFromRemote()
    const arch = await this.getArchitecture()
    const target = ARCH_PATHS[arch]

    // remove /binaries dir
    nova.fs.rmdir(binaryDir)

    // make directory
    const installPath = path.join(binaryDir, remoteVersion, target)
    nova.fs.mkdir(installPath)

    // download correct version
    console.log('Downloading TabNine...')
    const zipPath = await this.downloadBinary(installPath, remoteVersion, target)

    // unzip
    await this.unzipBinary(zipPath, installPath)

    // make executable
    await Promise.all(
      nova.fs.listdir(installPath).map(async (file) => {
        await this.makeExecutable(path.join(installPath, file))
      }),
    )

    return true
  }

  getVersionFromRemote(): Promise<string> {
    return new Promise((resolve, reject) => {
      const curl = new Process('/usr/bin/env', {
        args: ['curl', '-sS', 'https://update.tabnine.com/bundles/version'],
      })

      curl.onStdout(resolve)
      curl.onStderr(reject)
      curl.start()
    })
  }

  downloadBinary(installPath: string, version: string, target: string): Promise<string> {
    const versionTargetPath = `${version}/${target}`
    const output = path.join(installPath, 'TabNine.zip')
    console.log('downloading to', output)
    return new Promise((resolve, reject) => {
      const curl = new Process('/usr/bin/env', {
        args: [
          'curl',
          '-sS',
          `https://update.tabnine.com/bundles/${versionTargetPath}/TabNine.zip`,
          '--output',
          output,
        ],
      })

      curl.onDidExit(() => resolve(output))
      curl.onStderr(reject)
      curl.start()
    })
  }

  unzipBinary(zipPath: string, outputPath: string) {
    console.log('unzipping ', zipPath)
    return new Promise((resolve, reject) => {
      const unzip = new Process('/usr/bin/env', {
        args: ['unzip', '-o', zipPath, '-d', outputPath],
      })

      unzip.onDidExit(resolve)
      unzip.onStderr(reject)
      unzip.start()
    })
  }

  makeExecutable(filePath: string) {
    return new Promise((resolve, reject) => {
      const chmod = new Process('/usr/bin/env', {
        args: ['chmod', '+x', filePath],
      })

      chmod.onDidExit(resolve)
      chmod.onStderr(reject)

      console.log(`Making ${filePath} executable`)
      chmod.start()
    })
  }

  destroy() {
    try {
      this.reader?.dispose()
      this.didExit?.dispose()
      this.stdErr?.dispose()
      this.process?.terminate()
    } catch (error) {
      console.log(error)
    }
  }
}

export default TabNineService
