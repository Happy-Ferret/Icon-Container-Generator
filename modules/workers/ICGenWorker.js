'use strict';

// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('resource://gre/modules/workers/require.js');

// Globals
var core = { // have to set up the main keys that you want when aCore is merged from mainthread in init
	addon: {
		path: {
			content: 'chrome://icon-container-generator/content/',
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	}
};
var WORKER = this;
var OSStuff = {}; // global vars populated by init, based on OS

// Imports that use stuff defined in chrome
// I don't import ostypes_*.jsm yet as I want to init core first, as they use core stuff like core.os.isWinXP etc
// imported scripts have access to global vars on MainWorker.js
importScripts(core.addon.path.content + 'modules/cutils.jsm');
importScripts(core.addon.path.content + 'modules/ctypes_math.jsm');
importScripts(core.addon.path.content + 'modules/unixToolbox/interface.js');

unixToolboxInit(this);
var convert = new Interface(core.addon.path.content + 'modules/unixToolbox/convert-worker.js');
convert.on_stdout = function(txt) { console.log(txt); };
convert.on_stderr = function(txt) { console.log(txt); };


convert.addUrl(core.addon.path.content + 'modules/unixToolbox/config/magic.xml',   '/usr/local/etc/ImageMagick/', true);
convert.addUrl(core.addon.path.content + 'modules/unixToolbox/config/coder.xml',   '/usr/local/etc/ImageMagick/');
convert.addUrl(core.addon.path.content + 'modules/unixToolbox/config/policy.xml',  '/usr/local/etc/ImageMagick/');
convert.addUrl(core.addon.path.content + 'modules/unixToolbox/config/english.xml', '/usr/local/etc/ImageMagick/');
convert.addUrl(core.addon.path.content + 'modules/unixToolbox/config/locale.xml',  '/usr/local/etc/ImageMagick/');
convert.addUrl(core.addon.path.content + 'modules/unixToolbox/config/delegates.xml',  '/usr/local/etc/ImageMagick/');

convert.addUrl(OS.Path.toFileURI(OS.Path.join(OS.Constants.Path.desktopDir, 'Image-Box-64.png')), '/');

  convert.allDone().then(function() {
    convert.run('-rotate', '90', '/Image-Box-64.png', '/Image-Box-64-rot90.jpeg').then(function() {
      convert.getFile('Image-Box-64-rot90.jpeg').then(function(real_contents) {
		  OS.File.writeAtomic(OS.Path.join(OS.Constants.Path.desktopDir, 'Image-Box-64-rot.jpeg'), new Uint8Array(real_contents), { tmpPath: OS.Path.join(OS.Constants.Path.desktopDir, 'Image-Box-64-rot-jpeg.txt.tmp') });
      });
    });
  });

// Setup SICWorker
// instructions on using SICWorker
	// to call a function in the main thread function scope (which was determiend on SICWorker call from mainthread) from worker, so self.postMessage with array, with first element being the name of the function to call in mainthread, and the reamining being the arguments
	// the return value of the functions here, will be sent to the callback, IF, worker did worker.postWithCallback
const SIC_CB_PREFIX = '_a_gen_cb_';
self.onmessage = function(aMsgEvent) {
	// note:all msgs from bootstrap must be postMessage([nameOfFuncInWorker, arg1, ...])
	var aMsgEventData = aMsgEvent.data;
	
	console.log('worker receiving msg:', aMsgEvent);
	var callbackPendingId;
	if (typeof aMsgEventData[aMsgEventData.length-1] == 'String' && aMsgEventData[aMsgEventData.length-1].indexOf(SIC_CB_PREFIX) == 0) {
		callbackPendingId = aMsgEventData.pop();
	}
	
	var rez_worker_call = WORKER[aMsgEventData.shift()].apply(null, aMsgEventData);
	
	if (callbackPendingId) {
		self.postMessage([callbackPendingId, rez_worker_call]);
	}
};

////// end of imports and definitions

function init(objCore) {
	//console.log('in worker init');
	
	// merge objCore into core
	// core and objCore is object with main keys, the sub props
	
	core = objCore;
	
	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.content + 'modules/ostypes_win.jsm');
			break
		case 'gtk':
			importScripts(core.addon.path.content + 'modules/ostypes_x11.jsm');
			break;
		case 'darwin':
			importScripts(core.addon.path.content + 'modules/ostypes_mac.jsm');
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
	// OS Specific Init
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		default:
			// do nothing special
	}
	
	console.log('init worker done');
	
	self.postMessage(['init']);
}

// Start - Addon Functionality

function asyncMonitorMouse() {
	// this will get copy eve mouse events and deliver it to main thread
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				var rid_js = new Array(1);
				rid_js[0] = ostypes.TYPE.RAWINPUTDEVICE(1, 2, 0, null); // mouse
				
				/*
				usUsagePage
				1 for generic desktop controls
				2 for simulation controls
				3 for vr
				4 for sport
				5 for game
				6 for generic device
				7 for keyboard
				8 for leds
				9 button
				*/
				
				/*
				usUsage values when usUsagePage is 1
				0 - undefined
				1 - pointer
				2 - mouse
				3 - reserved
				4 - joystick
				5 - game pad
				6 - keyboard
				7 - keypad
				8 - multi-axis controller
				9 - Tablet PC controls
				*/
				
				var rid_c = ostypes.TYPE.RAWINPUTDEVICE.array(rid_js.length)(rid_js);
				var rez_registerDevices = ostypes.API('RegisterRawInputDevices')(rid_c, rid_js.length, ostypes.TYPE.RAWINPUTDEVICE.size);
				console.info('rez_registerDevices:', rez_registerDevices.toString(), uneval(rez_registerDevices), cutils.jscGetDeepest(rez_registerDevices));
				if (rez_registerDevices == false) {
					console.error('Failed rez_registerDevices, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed rez_registerDevices, winLastError: "' + ctypes.winLastError + '" and rez_registerDevices: "' + rez_registerDevices.toString(),
						winLastError: ctypes.winLastError
					});
				}
				
				
				
			break
		case 'gtk':
			
				
			
			break;
		case 'darwin':
			
				
			
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}
// End - Addon Functionality


// Start - Common Functions


// End - Common Functions