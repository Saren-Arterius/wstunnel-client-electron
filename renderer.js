const wst = require('wstunnel');
const shell = require('electron').shell;
const fs = require('fs');

const LAST_USING_FILE = 'last-using.json';

let currentWSClient;
let lock = false;
let page = $('html, body');

let oldLog = console.log;
console.log = function (message) {
  oldLog.apply(console, arguments);
  $('#console-output').text($('#console-output').text() + arguments[0] + '\n');
  var elem = document.getElementById('console-output-container');
  elem.scrollTop = elem.scrollHeight;
};

window.onerror = function (error, url, line) {
  console.log(error);
};

// open links externally by default
$(document).on('click', 'a[href^="http"]', function (event) {
  event.preventDefault();
  shell.openExternal(this.href);
});
let pollingInterval = setInterval(function () {
  let a = $('#star-container iframe').contents().find('a');
  if (!a.length) {
    return;
  }
  a.bind('click', function (event) {
    event.preventDefault();
    shell.openExternal(this.href);
  });
  clearInterval(pollingInterval);
}, 200);

let remoteServerAndLocalPort = function () {
  let port = parseInt($('#local-port').val().trim(), 10);
  if (!port) port = 30000;
  return [$('#remote-server').val().trim(), port];
};

let spawnWSTunnel = function (callback) {
  let rslp = remoteServerAndLocalPort();
  require('machine-uuid')(function (machineId) {
    require('wstunnel/lib/httpSetup').config('', false);
    let client = new wst.client();
    client.verbose();
    callback(client.start(rslp[1], rslp[0], void 0, {
      'x-wstclient': machineId
    }));
  });
};

let stopWSTunnel = function (callback) {
  currentWSClient.close(callback);
};

let updateUI = function () {
  if (currentWSClient) {
    $('#remote-server').attr('disabled', true);
    $('#local-port').attr('disabled', true);
    $('#button-text').text('Stop');
    page.animate({
      scrollTop: $(document).height() - $(window).height()
    }, 1000, 'easeOutQuint');
  } else {
    $('#remote-server').removeAttr('disabled');
    $('#local-port').removeAttr('disabled');
    $('#button-text').text('Start');
  }
};

let toggleLock = function (l) {
  lock = l;
  if (lock) {
    $('#toggle-btn').addClass('disabled');
  } else {
    $('#toggle-btn').removeClass('disabled');
  }
};

let toggleWSClient = function () {
  if (lock) {
    return;
  }
  toggleLock(true);
  let rslp = remoteServerAndLocalPort();
  if (!currentWSClient) {
    fs.writeFile(LAST_USING_FILE, JSON.stringify({
      remoteServer: rslp[0],
      localPort: rslp[1],
      autoStart: true
    }), function () {});
    spawnWSTunnel(function (client) {
      currentWSClient = client;
      toggleLock(false);
      updateUI();
      console.log(`==* WSTunnel client started: localhost:${rslp[1]} => ${rslp[0]} *==`);
    });
  } else {
    fs.writeFile(LAST_USING_FILE, JSON.stringify({
      remoteServer: rslp[0],
      localPort: rslp[1],
      autoStart: false
    }), function () {});
    stopWSTunnel(function (error) {
      if (error) {
        console.log(error);
      }
      currentWSClient = null;
      toggleLock(false);
      updateUI();
      console.log('==* WSTunnel client stopped *==');
    });
  }
};

$('#main-form').submit(function (event) {
  event.preventDefault();
  toggleWSClient();
});

page.on('scroll mousedown wheel DOMMouseScroll mousewheel keyup touchmove', function () {
  page.stop();
});

$(function () {
  fs.readFile(LAST_USING_FILE, function (err, data) {
    if (err || !data) return;
    try {
      let json = JSON.parse(data);
      $('#remote-server').val(json.remoteServer);
      $('#local-port').val(json.localPort);
      if (json.autoStart) {
        toggleWSClient();
      }
    } catch (e) {
      console.log(e);
    }
  });
});
