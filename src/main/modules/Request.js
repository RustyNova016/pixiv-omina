import EventEmitter from 'events';
import { net, session } from 'electron';
import { debug } from '@/global';//

/**
 * @class
 */
class Request extends EventEmitter {
  /**
   * @constructor
   * @param {Object} options
   * @param {string} options.url
   * @param {Electron.Session} options.session
   * @param {string} options.partition
   * @param {Array} options.headers
   */
  constructor(options) {
    super();

    /**
     * Cannot use this reference before super called
     */
    this.options = Object.assign({}, Request.globalOptions, options);

    /**
     * @type {Electron.ClientRequest}
     */
    this.request = net.request(this.options);

    this.attachListenersToRequest();
  }

  static globalOptions = {};

  static setGlobalOptions(options) {
    Request.globalOptions = options;
  }

  static updateGlobalOptions(options) {
    Object.keys(options).forEach(key => {
      Request.globalOptions[key] = options[key];
    });
  }

  static removeGlobalOptions(optionKeys) {
    optionKeys.forEach(key => {
      if (typeof Request.globalOptions[key] !== undefined) {
        delete Request.globalOptions[key];
      }
    });
  }

  attachListenersToRequest() {

    this.request.on('login', (proxyInfo, cb) => {
      if (proxyInfo.isProxy) {
        let username = this.options.proxyUsername || '',
            password = this.options.proxyPassword || '';

        if (typeof username === 'string' && typeof password === 'string') {
          cb(username, password);
        }
      }
    });

    this.request.on('response', response => {
      debug.sendStatus(`Get response from ${this.options.url}`);

      this.emit('response', response);

      response.on('data', () => {
        debug.sendStatus(`Response: Receiving data from ${this.options.url}`);
      });

      response.on('aborted', () => {
        debug.sendStatus(`Response: Abort receive data from ${this.options.url}`);
      });

      response.on('error', error => {
        debug.sendStatus(`Response: Error ${error.message} occured while receiving data from ${this.options.url}`);
      });

      response.on('end', () => {
        debug.sendStatus(`Response: All data received from ${this.options.url}`);
      });
    });

    this.request.on('close', () => {
      debug.sendStatus(`Request: ${this.options.url} closed`);

      this.emit('close');
    });

    this.request.on('error', error => {
      debug.sendStatus(`Request: ${this.options.url} error ${error.message}`);

      this.emit('error', error);
    });

    this.request.on('abort', () => {
      debug.sendStatus(`Request: ${this.options.url} abort`);

      this.emit('abort');
    });

    this.request.on('finish', () => {
      debug.sendStatus(`Request: ${this.options.url} all data sended`);

      this.emit('finish');
    });
  }

  setHeader(name, value) {
    this.request.setHeader(name, value);
  }

  /**
   * @returns {void}
   */
  end() {
    let matches = this.options.url.match(/^(https?:\/{2}[^/]+)/);
    let ses;

    if (this.options) {
      if (this.options.session) {
        ses = this.options.session;
      } else if (this.options.partition) {
        ses = session.fromPartition(this.options.partition);
      }

      let cookieString = '';

      ses.cookies.get({
        url: matches[1]
      }).then(cookies => {
        cookies.forEach(cookie => {
          cookieString += `${cookie.name}=${cookie.value}; `;
        });

        this.request.setHeader('cookie', cookieString);
        this.request.end();
      });

      return;
    }

    this.request.end();
  }
}

export default Request;
