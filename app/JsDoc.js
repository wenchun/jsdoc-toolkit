/**
 * @fileOverview An automated documentation publishing system for JavaScript.
 * @name JsDoc Toolkit
 * @author Michael Mathews <a href="mailto:micmath@gmail.com">micmath@gmail.com</a>
 * @revision $Id$
 * @license <a href="http://en.wikipedia.org/wiki/MIT_License">X11/MIT License</a>
 *          (See the accompanying README file for full details.)
 */
 
LOG = {
	warn: function(msg, e) {
		if (e) msg = e.fileName+", line "+e.lineNumber+": "+msg;
		print(">> WARNING: "+msg);
	},

	inform: function(msg) {
		print(" > "+msg);
	}
};

JsDoc = {};

/** @constructor */
function DocFile(path) {
	this.overview = new Symbol(path, [], "FILE", "");
	this.overview.alias = path
	this.symbols = [];
}

DocFile.prototype.addSymbol = function(s) {
	this.symbols.push(s);
}

DocFile.prototype.getSymbol = function(alias) {
	for (var i = 0; i < this.symbols.length; i++) {
		if (this.symbols[i].alias == alias) return this.symbols[i];
	}
    return null;
}

function publish() {}

JsDoc.parse = function(srcFiles) {
	var files = [];
	
	if (typeof srcFiles == "string") srcFiles = [srcFiles];	
	var parser = new JsParse();
	
	srcFiles = srcFiles.sort();
	
	// handle setting up relationships between symbols here
	for (var f = 0; f < srcFiles.length; f++) {
		var srcFile = srcFiles[f];
		
		LOG.inform("Tokenizing: file "+(f+1)+", "+srcFile);
		var src = IO.readFile(srcFile);
		
		var tokens = new TokenReader(src).tokenize();
		LOG.inform("\t"+tokens.length+" tokens found.");
		var ts = new TokenStream(tokens);
		
		var file = new DocFile(srcFile);
		parser.parse(ts);
		LOG.inform("\t"+parser.symbols.length+" symbols found.");
		
		for (var s = 0; s < parser.symbols.length; s++) {
			if (parser.symbols[s].doc.getTag("ignore").length)
				continue;
				
			if (parser.symbols[s].doc.getTag("private").length && !JsDoc.opt.p)
				continue;
			
			var parents;
			if ((parents = parser.symbols[s].doc.getTag("memberof")) && parents.length) {
				parser.symbols[s].name = parents[0]+"/"+parser.symbols[s].name;
				parser.symbols[s].doc._dropTag("memberof");
			}
			
			if (parser.symbols[s].desc == "undocumented") {
				if (/(^_|[.\/]_)/.test(parser.symbols[s].name) && !JsDoc.opt.A) {
					continue;
				}
				if (!JsDoc.opt.a && !JsDoc.opt.A) {
					continue;
				}
			}
			
			// is this a member of another object?
			var parts = null;
			if (
				parser.symbols[s].name.indexOf("/") > -1
				&& (parts = parser.symbols[s].name.match(/^(.+)\/([^\/]+)$/))
			) {
				var parentName = parts[1].replace(/\//g, ".");
				var childName = parts[2];
				
				parser.symbols[s].alias = parser.symbols[s].name.replace(/\//g, ".");
				parser.symbols[s].name = childName;
				parser.symbols[s].memberof = parentName;

				// is the parent defined?
				var parent = file.getSymbol(parentName);

				if (!parent) LOG.warn("Member '"+childName+"' documented but no documentation exists for parent object '"+parentName+"'.");
				else {
					if (parser.symbols[s].is("OBJECT")) {
						parent.properties.push(parser.symbols[s]);
					}
					if (parser.symbols[s].is("FUNCTION")) {
						parent.methods.push(parser.symbols[s]);
					}
				}
			}
			
			// does this inherit methods or properties?
			for (var i = 0; i < parser.symbols[s].inherits.length; i++) {
				var base = file.getSymbol(parser.symbols[s].inherits[i]);
				if (!base) {
					LOG.warn("Can't determine inherited methods or properties from unfound '"+parser.symbols[s].inherits[i]+"' symbol.");
				}
				else {
					parser.symbols[s].inheritedMethods =
						parser.symbols[s].inheritedMethods.concat(base.methods);
					parser.symbols[s].inheritedProperties =
						parser.symbols[s].inheritedProperties.concat(base.properties);
				}
			}
			
			file.addSymbol(parser.symbols[s]);
		}
		
		if (parser.overview) file.overview = new Symbol(srcFile, [], "FILE", parser.overview);
		else file.overview = new Symbol(srcFile, [], "FILE", "/** @overview No overview provided. */");
		
		files.push(file);
	}
	return files;
}

/**
 * Print out the expected usage syntax for this script on the command
 * line. This is called automatically by using the -h/--help option.
 */
JsDoc.usage = function() {
	print("USAGE: java -jar app/js.jar app/jsdoc.js [OPTIONS] <SRC_DIR> <SRC_FILE> ...");
	print("");
	print("OPTIONS:");
	print("  -t=<PATH> or --template=<PATH>\n          Required. Use this template to format the output.\n");
	print("  -d=<PATH> or --directory=<PATH>\n          Output to this directory (defaults to js_docs_out).\n");
	print("  -r=<DEPTH> or --recurse=<DEPTH>\n          Descend into src directories.\n");
	print("  -x=<EXT>[,EXT]... or --ext=<EXT>[,EXT]...\n          Scan source files with the given extension/s (defaults to js).\n");
	print("  -a or --allfunctions\n          Include all functions, even undocumented ones.\n");
	print("  -A or --Allfunctions\n          Include all functions, even undocumented, underscored ones.\n");
	print("  -p or --private\n          Include symbols tagged as private.\n");
    print("  -h or --help\n          Show this message and exit.\n");
	
	java.lang.System.exit(0);
}