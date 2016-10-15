'use strict';

let fs = require('fs'),
	path = require('path');


function readdirRecurse(startDir,extension,callback) {

	let basePathRemoveRegExp = RegExp(`^${path.resolve(startDir)}/`),
		extensionMatchRegExp = RegExp(`\\.${extension}$`),
		resultList = [],
		queueCount = 1, // start at 1 to account for initial call to fetch()
		isFinished;

	function fetch(dir) {

		fs.readdir(dir,(err,list) => {

			if (err) {
				// error
				return finish([]);
			}

			queueCount--; // drop by 1 for initial/recursive call to fetch()
			queueCount += list.length;

			if (!queueCount) {
				// everything processed
				return finish();
			}

			list.forEach((sourceFile) => {

				// resolve full path to file, stat for file or directory
				sourceFile = path.resolve(dir,sourceFile);
				fs.stat(sourceFile,(err,stat) => {

					if (err) {
						// error
						return finish([]);
					}

					queueCount--;
					if (stat && stat.isDirectory()) {
						// recurse into directory, increment queueCount (decremented on callback from fs.readdir())
						queueCount++;
						return fetch(sourceFile);
					}

					if (extensionMatchRegExp.test(sourceFile)) {
						// file item matches extension, add to resultList stack
						resultList.push(sourceFile.replace(basePathRemoveRegExp,''));
					}

					if (!queueCount) {
						// everything processed
						return finish();
					}
				});
			});
		});
	}

	function finish(list) {

		// if already called finish(), no work
		if (isFinished) return;
		isFinished = true;

		// sort result list and pass to callback
		resultList = (list === undefined) ? resultList : list;
		callback(resultList.sort((a,b) => {

			if (a > b) return 1;
			if (a < b) return -1;
			return 0;
		}));
	}

	// start working over dir
	fetch(startDir);
}


{
	let SCSS_EXTENSION = 'scss',
		FILE_ENCODING = 'utf8',

		FILE_ROLE_COMPONENT = 'component',
		FILE_ROLE_CONFIG = 'config',
		FILE_ROLE_LAYOUT = 'layout',
		FILE_ROLE_MIXIN = 'mixin',
		FILE_ROLE_MODULE = 'module',
		FILE_ROLE_STYLE = 'style',

		LINE_SEPARATOR_REGEXP = /\r?\n/;

	function logError(message) {

		console.log(`Error: ${message}`);
	}

	function getScanDir() {

		function reportDirError() {

			logError('SCSS scan directory given does not exist and/or is not a directory');
			return false;
		}

		let argvCount = process.argv.length,
			scanDir = path.resolve('.'); // default scan dir if not given

		if (argvCount > 3) {
			// invalid argument count
			logError('Invalid arguments given');
			console.log(`\nUsage: ${process.argv[0]} ${path.basename(process.argv[1])} [SCSS scan dir]`);

			return false;
		}

		if (argvCount == 3) {
			// scan dir given
			scanDir = path.resolve(process.argv[2]);
		}

		// validate scan dir exists
		let stat;
		try {
			stat = fs.statSync(scanDir);

		} catch(e) {
			// unable to stat scanDir
			return reportDirError();
		}

		if (stat && stat.isDirectory()) {
			// all valid
			return scanDir;
		}

		// error with given directory
		return reportDirError();
	}

	function processResultList(baseDir,resultList) {

		let processQueueCount = 0,
			lintFileCount = 0,
			lintResultCollection = {};

		function getFileRole(sourceFile) {

			if (/^component\//.test(sourceFile)) return FILE_ROLE_COMPONENT;
			if (/^module\//.test(sourceFile)) return FILE_ROLE_MODULE;
			if (sourceFile == `config.${SCSS_EXTENSION}`) return FILE_ROLE_CONFIG;
			if (sourceFile == `layout.${SCSS_EXTENSION}`) return FILE_ROLE_LAYOUT;
			if (sourceFile == `mixin.${SCSS_EXTENSION}`) return FILE_ROLE_MIXIN;
			if (sourceFile == `style.${SCSS_EXTENSION}`) return FILE_ROLE_STYLE;

			// unable to determine file role
			return false;
		}

		function openSourceFile(sourceFile,sourceFileRole) {

			function complete() {

				if (processQueueCount < 1) {
					// processing queue is done - display results
					renderResults(
						resultList.length,lintFileCount,
						lintResultCollection
					);
				}
			}

			// open file read only
			processQueueCount++;
			let fullFilePath = `${baseDir}/${sourceFile}`;

			fs.readFile(
				fullFilePath,FILE_ENCODING,
				(err,fileData) => {

					processQueueCount--;

					if (err) {
						// unable to open file for reading - skip
						logError(`Unable to open ${fullFilePath} for reading`);
						return complete();
					}

					lintFile(sourceFile,sourceFileRole,fileData);
					lintFileCount++;

					return complete();
				}
			);
		}

		function lintFile(sourceFile,sourceFileRole,fileData) {

			let sourceFileBaseName;

			function isFileRoleIn() {

				return (Array.from(arguments).indexOf(sourceFileRole) >= 0);
			}

			function addLintError(lineNumber,errorText) {

				if (!lintResultCollection[sourceFile]) {
					// create collection item for [sourceFile]
					lintResultCollection[sourceFile] = [];
				}

				// add error message to stack
				lintResultCollection[sourceFile].push([lineNumber + 1,errorText]);
			}

			function lintPrefixChars(firstChar,lineText) {

				let secondChar = false,
					subStrCount = (firstChar === false) ? 1 : 2;

				// set prefix character check based on file role
				if (sourceFileRole == FILE_ROLE_COMPONENT) secondChar = 'c';
				if (sourceFileRole == FILE_ROLE_LAYOUT) secondChar = 'l';
				if (sourceFileRole == FILE_ROLE_MODULE) secondChar = 'm';

				return (secondChar === false)
					? true // variable/placeholder is in a file role we don't need to worry about
					: (lineText.substr(0,subStrCount) == (((firstChar === false) ? '' : firstChar) + secondChar));
			}

			function lintVariable(lineText) {

				// check prefix character based on file role
				if (!lintPrefixChars('$',lineText)) return false;

				// validate naming for a config.scss variable
				if (
					(sourceFileRole == FILE_ROLE_CONFIG) &&
					(!/^\$[a-z][A-Za-z0-9_]+:/.test(lineText))
				) return false;

				// validate naming for a layout.scss variable
				if (
					(sourceFileRole == FILE_ROLE_LAYOUT) &&
					(!/^\$l[A-Z][A-Za-z0-9]+:/.test(lineText))
				) return false;

				// validate naming for a component/module variable
				if (isFileRoleIn(FILE_ROLE_COMPONENT,FILE_ROLE_MODULE)) {
					// after underscore, first character must be lowercase
					if (!/^\$[cm][A-Z][A-Za-z]+_[a-z][A-Za-z0-9]+:/.test(lineText)) return false;

					// ensure prefix namespace for variable matches source file base name
					if (!RegExp(`^\\$[cm]${sourceFileBaseName}_`).test(lineText.toLowerCase())) return false;
				}

				// all valid
				return true;
			}

			function lintPlaceHolder(lineText) {

				// check prefix character based on file role
				if (!lintPrefixChars('%',lineText)) return false;

				// validate naming for a layout placeholder
				if (
					(sourceFileRole == FILE_ROLE_LAYOUT) &&
					(!/^%l[A-Z][A-Za-z0-9]+[,:. {]/.test(lineText))
				) return false;

				// validate naming for a component/module placeholder
				if (isFileRoleIn(FILE_ROLE_COMPONENT,FILE_ROLE_MODULE)) {
					// component placeholders can be named just that of the source file - check if this format matches
					// e.g. "%cCOMPONENTNAME", rather than "%cCOMPONENTNAME_subName"
					let isSimple;

					if (sourceFileRole == FILE_ROLE_COMPONENT) {
						if (RegExp(`^%c${sourceFileBaseName}[,:. {]`).test(lineText.toLowerCase())) {
							// yes this is a simple placeholder - ensure first character after '%c' is a letter and uppercase
							isSimple = true;
							if (!/^%c[A-Z]/.test(lineText)) return false;
						}
					}

					if (!isSimple) {
						// not a simple placeholder - expecting "%cCOMPONENTNAME_subName" format
						// after underscore, first character must be lowercase
						if (!/^%[cm][A-Z][A-Za-z]+_[a-z][A-Za-z0-9]+[,:. {]/.test(lineText)) return false;

						// ensure prefix namespace for placeholder matches source file base name
						if (!RegExp(`^%[cm]${sourceFileBaseName}_`).test(lineText.toLowerCase())) return false;
					}
				}

				// all valid
				return true;
			}

			function lintSassFunctionMixin(checkType,lineText) {

				// extract name
				let checkName = RegExp(`^@${checkType} +([^\( ]+)`).exec(lineText);
				if (!checkName) return false;

				// check function prefix character based on file role
				checkName = checkName[1];
				if (!lintPrefixChars(false,checkName)) return false;

				// validate naming for a layout function
				if (
					(sourceFileRole == FILE_ROLE_LAYOUT) &&
					(!/^l[A-Z][A-Za-z0-9]+$/.test(checkName))
				) return false;

				// validate naming for a component/module function
				if (isFileRoleIn(FILE_ROLE_COMPONENT,FILE_ROLE_MODULE)) {
					// after underscore, first character must be lowercase
					if (!/^[cm][A-Z][A-Za-z]+_[a-z][A-Za-z0-9]+$/.test(checkName)) return false;

					// ensure prefix namespace for function matches source file base name
					if (!RegExp(`^[cm]${sourceFileBaseName}_`).test(checkName.toLowerCase())) return false;
				}

				// all valid
				return true;
			}

			function lintClass(lineText) {

				// class name should be all lower case letters, digits and dashes only
				if (!/^\.[a-z0-9][a-z0-9-]*[a-z0-9][,:. {]/.test(lineText)) return false;

				// validate naming for class
				if (!RegExp(`^\.${sourceFileBaseName}[,:.\\- {]`).test(lineText.toLowerCase())) return false;

				// all valid
				return true;
			}

			// build base name from the source file name (minus a possible leading underscore) used for namespacing checks
			sourceFileBaseName = path.basename(sourceFile,'.' + SCSS_EXTENSION).toLowerCase();
			sourceFileBaseName = sourceFileBaseName.replace(/^_/,'');
			console.log(`File: ${sourceFile}`);

			// work over each file line looking for linting errors
			fileData.split(LINE_SEPARATOR_REGEXP).forEach((lineText,lineNumber) => {

				let lineTextTrim = lineText.trim();
				lineText = lineText.trimRight();

				// root level comment
				if (/^\/\//.test(lineText)) {
					// if TODO comment, skip checks
					if (!/^\/\/ +TODO:/.test(lineText)) {
						// is comment style [// -- detail --]
						if (
							isFileRoleIn(FILE_ROLE_COMPONENT,FILE_ROLE_LAYOUT,FILE_ROLE_MIXIN,FILE_ROLE_MODULE) &&
							(!/^\/\/ -- [^ ].+[^ ] --/.test(lineText))
						) {
							addLintError(lineNumber,'Root level comments should be in the form -> // -- top level comment --');
						}
					}

					// done
					return;
				}

				// variables
				if (/^\$[^ ]+:/.test(lineTextTrim)) {
					if (sourceFileRole == FILE_ROLE_STYLE) {
						// no variables in style.scss file allowed
						addLintError(lineNumber,'Variables should not be defined here, use config.scss file');

					} else {
						if (!lintVariable(lineTextTrim)) {
							addLintError(lineNumber,'Invalid variable name');
						}
					}
				}

				// placeholder selectors
				if (/^%/.test(lineTextTrim)) {
					if (isFileRoleIn(FILE_ROLE_CONFIG,FILE_ROLE_MIXIN,FILE_ROLE_STYLE)) {
						// no placeholder selectors should be here
						addLintError(lineNumber,'Placeholder selectors should not be used here');

					} else {
						// placeholder selectors allowed - check format
						if (!lintPlaceHolder(lineTextTrim)) {
							addLintError(lineNumber,'Invalid placeholder selector name');
						}
					}
				}

				// functions
				if (/^@function /.test(lineTextTrim)) {
					if (isFileRoleIn(FILE_ROLE_CONFIG,FILE_ROLE_STYLE)) {
						// no Sass functions should be here
						addLintError(lineNumber,'Sass functions should not be used here');

					} else {
						// Sass functions allowed - check format
						if (!lintSassFunctionMixin('function',lineTextTrim)) {
							addLintError(lineNumber,'Invalid Sass function name');
						}
					}
				}

				// mixins
				if (/^@mixin /.test(lineTextTrim)) {
					if (isFileRoleIn(FILE_ROLE_CONFIG,FILE_ROLE_STYLE)) {
						// no mixins should be here
						addLintError(lineNumber,'Mixins should not be used here');

					} else {
						// mixins allowed - check format
						if (!lintSassFunctionMixin('mixin',lineTextTrim)) {
							addLintError(lineNumber,'Invalid mixin name');
						}
					}
				}

				// classes
				if (/^\./.test(lineTextTrim)) {
					if (sourceFileRole != FILE_ROLE_MODULE) {
						// no class selectors should be here
						addLintError(lineNumber,'Class selectors should not be used here');

					} else {
						// class selectors allowed - check format
						if (!lintClass(lineTextTrim)) {
							addLintError(lineNumber,'Invalid class selector name');
						}
					}
				}
			});
		}

		// queue up each file in resultList
		resultList.forEach((sourceFile) => {

			// get file role
			let sourceFileRole = getFileRole(sourceFile);
			if (sourceFileRole === false) {
				// skip linting file
				return;
			}

			// add file to process queue counter and read file
			openSourceFile(sourceFile,sourceFileRole);
		});
	}

	function renderResults(resultCount,lintedCount,lintResultCollection) {

		function getLintResultSummaryCounts() {

			let fileCount = 0,
				errorCount = 0;

			for (let fileName of Object.keys(lintResultCollection)) {
				fileCount++;
				errorCount += lintResultCollection[fileName].length;
			}

			return (fileCount > 0) ? [fileCount,errorCount] : false;
		}

		function renderErrorDetails() {

			for (let fileName of Object.keys(lintResultCollection)) {
				console.log(`${fileName}:`);

				lintResultCollection[fileName].forEach((errorItem) => {

					let lineNumber = errorItem[0],
						paddingSpaces = ' ';

					// calculate padding of line number
					while ((lineNumber + paddingSpaces).length < 5) {
						paddingSpaces += ' ';
					}

					console.log(`  ${lineNumber}:${paddingSpaces}${errorItem[1]}`);
				});

				console.log();
			}
		}

		console.log(`\n\n${lintedCount} files linted (${resultCount - lintedCount} skipped)`);

		let summaryCounts = getLintResultSummaryCounts();
		if (summaryCounts === false) {
			// no errors found
			console.log('No linting errors found\n');

		} else {
			// display error details
			console.log(`${summaryCounts[1]} errors found in a total of ${summaryCounts[0]} files\n\n`);

			renderErrorDetails();
		}
	}

	// get scan dir from passed args, is not given - current working directory used
	let scanDir = getScanDir();
	if (scanDir === false) {
		// error with scan dir given
		return;
	}

	// got a valid scanDir, keep going
	console.log(`Linting: ${scanDir}`);
	readdirRecurse(scanDir,SCSS_EXTENSION,(resultList) => {

		if (!resultList.length) {
			// no SCSS files found
			logError(`Unable to locate any files matching *.${SCSS_EXTENSION}`);

		} else {
			// process result list
			console.log(`Found a total of ${resultList.length} file(s) for potential linting\n`);
			processResultList(scanDir,resultList);
		}
	});

	// TODO: add routine(s) to find placeholders that are not used, or used only once and report
	// TODO: when errors are reported - output the offending class/function/mixin name
}
