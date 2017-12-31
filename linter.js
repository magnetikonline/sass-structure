'use strict';

let fs = require('fs'),
	path = require('path');


function readDirRecursive(startDir,extension) {

	let extensionMatchRegExp = RegExp(`\\.${extension}$`),
		basePathRemoveRegExp = RegExp(`^${path.resolve(startDir)}/`),
		readDirQueue = [],
		fileList = [];

	function readDir(dir) {

		function getItemList(readDir) {

			return new Promise((resolve,reject) => {

				fs.readdir(readDir,(err,itemList) => {

					if (err) {
						return reject();
					}

					// resolve with parent path added to each item
					resolve(itemList.map((item) => path.resolve(readDir,item)));
				});
			});
		}

		function getItemListStat(itemList) {

			function getStat(itemPath) {

				return new Promise((resolve,reject) => {

					fs.stat(itemPath,(err,stat) => {

						if (err) {
							return reject();
						}

						// resolve with item path and if directory
						resolve({
							itemPath,
							isDirectory: stat.isDirectory()
						});
					});
				});
			}

			// stat all items in list
			return Promise.all(itemList.map(getStat));
		}

		function processItemList(itemList) {

			for (let {itemPath,isDirectory} of itemList) {
				if (isDirectory) {
					// add directory to queue
					readDirQueue.push(itemPath);
					continue;
				}

				if (extensionMatchRegExp.test(itemPath)) {
					// add file to list
					fileList.push(itemPath.replace(basePathRemoveRegExp,''));
				}
			}

			// if queue remaining, process directory recursive
			if (readDirQueue.length > 0) {
				return readDir(readDirQueue.shift());
			}

			// finished - sort and return file list
			return fileList.sort((a,b) => {

				if (a > b) return 1;
				if (a < b) return -1;
				return 0;
			});
		}

		// read directory list, stat each item and process result
		return getItemList(dir)
			.then(getItemListStat)
			.then(processItemList);
	}

	// commence reading at the top
	return readDir(startDir);
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

		return new Promise((resolve,reject) => {

			let argvCount = process.argv.length;
			if (argvCount > 3) {
				// invalid argument count
				logError('Invalid arguments given');
				console.log(`\nUsage: ${process.argv[0]} ${path.basename(process.argv[1])} [SCSS scan dir]`);

				return reject();
			}

			// if scan dir given, override default of current path
			let scanDir = (argvCount == 3)
				? path.resolve(process.argv[2])
				: path.resolve('.');

			// validate scan dir exists
			fs.stat(scanDir,(err,stat) => {

				// if stat error or path is not a directory, reject
				if (err || !stat.isDirectory()) {
					logError(`SCSS scan directory of ${scanDir} does not exist or is not a directory`);
					return reject();
				}

				// resolve with scanDir
				resolve(scanDir);
			});
		});
	}

	function processResultList(baseDir,resultList) {

		let lintFileCount = 0,
			lintErrorCollection = {},
			processQueue = Promise.resolve();

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

		function loadFile(filePath) {

			return new Promise((resolve,reject) => {

				fs.readFile(
					filePath,FILE_ENCODING,
					(err,fileData) => {

						if (err) {
							// unable to open file for reading
							logError(`Unable to load ${filePath} for reading`);
							return reject();
						}

						// resolve with loaded file data
						lintFileCount++;
						resolve(fileData);
					}
				);
			});
		}

		function lintFileData(sourceFile,fileRole,fileData) {

			function isFileRoleIn(...roleList) {

				return roleList.includes(fileRole);
			}

			function addLintError(lineNumber,errorText) {

				if (!lintErrorCollection[sourceFile]) {
					// create collection item for [sourceFile]
					lintErrorCollection[sourceFile] = [];
				}

				// add error message to stack
				lintErrorCollection[sourceFile].push({lineNumber,errorText});
			}

			function lintPrefixChar(firstChar,lineText) {

				// set prefix character check based on file role
				let prefixChar = false;
				if (fileRole == FILE_ROLE_COMPONENT) prefixChar = 'c';
				if (fileRole == FILE_ROLE_LAYOUT) prefixChar = 'l';
				if (fileRole == FILE_ROLE_MODULE) prefixChar = 'm';

				if (prefixChar === false) {
					// variable/placeholder is in a file role we don't need to worry about
					return true;
				}

				return (
					lineText.substr(0,(firstChar === false) ? 1 : 2) ==
					((firstChar || '') + prefixChar)
				);
			}

			function lintVariable(lineText) {

				// check prefix character based on file role
				if (!lintPrefixChar('$',lineText)) return false;

				// validate naming for a config.scss variable
				if (
					(fileRole == FILE_ROLE_CONFIG) &&
					(!/^\$[a-z][A-Za-z0-9_]+:/.test(lineText))
				) return false;

				// validate naming for a layout.scss variable
				if (
					(fileRole == FILE_ROLE_LAYOUT) &&
					(!/^\$l[A-Z][A-Za-z0-9]+:/.test(lineText))
				) return false;

				// validate naming for a component/module variable
				if (isFileRoleIn(FILE_ROLE_COMPONENT,FILE_ROLE_MODULE)) {
					// ensure prefix namespace for variable matches source file base name
					if (!RegExp(`^\\$[cm]${sourceFileBaseName}_`).test(lineText.toLowerCase())) return false;

					// after [cm] prefix next character to be uppercase, after underscore first character to be lowercase
					if (!/^\$[cm][A-Z][A-Za-z]+_[a-z][A-Za-z0-9]+:/.test(lineText)) return false;
				}

				// all valid
				return true;
			}

			function lintPlaceHolder(lineText) {

				// check prefix character based on file role
				if (!lintPrefixChar('%',lineText)) return false;

				// validate naming for a layout placeholder
				if (
					(fileRole == FILE_ROLE_LAYOUT) &&
					(!/^%l[A-Z][A-Za-z0-9]+[,:. {]/.test(lineText))
				) return false;

				// validate naming for a component/module placeholder
				if (isFileRoleIn(FILE_ROLE_COMPONENT,FILE_ROLE_MODULE)) {
					// component placeholders can be named just that of the source file - check if this format matches
					// e.g. "%cCOMPONENTNAME", rather than "%cCOMPONENTNAME_subName"
					let isSimple;

					if (fileRole == FILE_ROLE_COMPONENT) {
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
				if (!lintPrefixChar(false,checkName)) return false;

				// validate naming for a layout function
				if (
					(fileRole == FILE_ROLE_LAYOUT) &&
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
				if (!RegExp(`^\\.${sourceFileBaseName}[,:.\\- {]`).test(lineText.toLowerCase())) return false;

				// all valid
				return true;
			}

			// build base name from the source file name (minus a possible leading underscore) for namespacing checks
			let sourceFileBaseName = path.basename(sourceFile,`.${SCSS_EXTENSION}`).toLowerCase();
			sourceFileBaseName = sourceFileBaseName.replace(/^_/,'');
			console.log(`File: ${sourceFile}`);

			// work over each file line looking for linting errors
			let lineNumber = 0;
			for (let lineText of fileData.split(LINE_SEPARATOR_REGEXP)) {
				// trim up next file line
				let lineTextTrim = lineText.trim();
				lineText = lineText.trimRight();
				lineNumber++;

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
					continue;
				}

				// variables
				if (/^\$[^ ]+:/.test(lineTextTrim)) {
					if (fileRole == FILE_ROLE_STYLE) {
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
					if (fileRole != FILE_ROLE_MODULE) {
						// no class selectors should be here
						addLintError(lineNumber,'Class selectors should not be used here');

					} else {
						// class selectors allowed - check format
						if (!lintClass(lineTextTrim)) {
							addLintError(lineNumber,'Invalid class selector name');
						}
					}
				}
			}
		}

		// queue up each file from resultList
		for (let sourceFile of resultList) {
			// determine file role
			let fileRole = getFileRole(sourceFile);
			if (fileRole === false) {
				// can't determine - skip
				continue;
			}

			// add load/lint steps for file to processing queue
			processQueue = processQueue
				.then(() => loadFile(`${baseDir}/${sourceFile}`))
				.then((fileData) => {

					lintFileData(sourceFile,fileRole,fileData);
				});
		}

		// return lint file count and lint error collection
		return processQueue.then(() => {

			return {lintFileCount,lintErrorCollection};
		});
	}

	function renderResults(resultCount,lintedCount,lintErrorCollection) {

		function getLintErrorSummaryCounts() {

			let fileCount = 0,
				errorCount = 0;

			for (let fileName of Object.keys(lintErrorCollection)) {
				fileCount++;
				errorCount += lintErrorCollection[fileName].length;
			}

			return (fileCount > 0)
				? {fileCount,errorCount}
				: false;
		}

		function renderErrorDetails() {

			for (let fileName of Object.keys(lintErrorCollection)) {
				console.log(`${fileName}:`);

				for (let {lineNumber,errorText} of lintErrorCollection[fileName]) {
					// calculate padding of line number
					let paddingSpaces = ' ';
					while ((lineNumber + paddingSpaces).length < 5) {
						paddingSpaces += ' ';
					}

					console.log(`  ${lineNumber}:${paddingSpaces}${errorText}`);
				}

				console.log();
			}
		}

		console.log(`\n\n${lintedCount} files linted (${resultCount - lintedCount} skipped)`);

		let summaryCounts = getLintErrorSummaryCounts();
		if (summaryCounts === false) {
			// no errors
			console.log('No linting errors found\n');

		} else {
			// display error details
			console.log(`${summaryCounts.errorCount} errors found in a total of ${summaryCounts.fileCount} files\n\n`);
			renderErrorDetails();
		}
	}

	{
		let processScanDir,
			resultCount;

		// read and verify scan dir from CLI arguments - if not given use working directory
		getScanDir()
			.then((scanDir) => {

				processScanDir = scanDir;

				// find files in [scanDir] to validate
				return readDirRecursive(processScanDir,SCSS_EXTENSION)
					.catch(() => {

						return Promise.reject(
							new Error(`Unable to read ${processScanDir}`)
						);
					});
			})
			.then((resultList) => {

				if (resultList.length < 1) {
					// no SCSS files found for linting
					return Promise.reject(
						new Error(`Unable to locate any files matching *.${SCSS_EXTENSION}`)
					);

				} else {
					// process result list
					console.log(`Found a total of ${resultList.length} file(s) for potential linting\n`);
					resultCount = resultList.length;
					return processResultList(processScanDir,resultList);
				}
			})
			.then((data) => {

				// render results
				let {lintFileCount,lintErrorCollection} = data;

				renderResults(
					resultCount,
					lintFileCount,
					lintErrorCollection
				);
			})
			.catch((err) => {

				if (err instanceof Error) {
					logError(err.message);
				}
			});
	}

	// TODO: add routine(s) to find placeholders that are not used, or used only once and report
	// TODO: when errors are reported - output the offending class/function/mixin name
}
