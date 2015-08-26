var fs = require('fs');
var ejs = require('ejs');

/**
 * Generate iOS Client-side Objective-C representation of the models.
 *
 * @param {Object} app The loopback application created via `app = loopback()`.
 * @returns {string} An array of the generated source file contents.
 */
exports.objcModels = function generateServices(app, modelPrefix) {

  var models = describeModels(app);

  addObjCNames(models, modelPrefix);

  var objcModelHTemplate = readTemplate('./objc-model-h.ejs');
  var objcModelMTemplate = readTemplate('./objc-model-m.ejs');
  var objcRepoHTemplate  = readTemplate('./objc-repo-h.ejs');
  var objcRepoMTemplate  = readTemplate('./objc-repo-m.ejs');

  var ret = {};

  for (var modelName in models) {
    var script = renderContent(objcModelHTemplate, models[modelName]);
    ret[models[modelName].objcModelName + '.h'] = script;

    var script = renderContent(objcModelMTemplate, models[modelName]);
    ret[models[modelName].objcModelName + '.m'] = script;

    var script = renderContent(objcRepoHTemplate, models[modelName]);
    ret[models[modelName].objcModelName + 'Repository.h'] = script;

    var script = renderContent(objcRepoMTemplate, models[modelName]);
    ret[models[modelName].objcModelName + 'Repository.m'] = script;
  }

  return ret;
};

function describeModels(app) {
  var result = {};
  for(var model in app.models) {
    model.get;
  }
  app.handler('rest').adapter.getClasses().forEach(function(c) {
    var name = c.name;

    if (!c.ctor) {
      // Skip classes that don't have a shared ctor
      // as they are not LoopBack models
      console.error('Skipping %j as it is not a LoopBack model', name);
      return;
    }
    c.methods.forEach(function fixArgsOfPrototypeMethods(method) {
      var ctor = method.restClass.ctor;
      if (!ctor || method.sharedMethod.isStatic) return;
      method.accepts = ctor.accepts.concat(method.accepts);
    });
    c.pluralName = c.sharedClass.ctor.pluralModelName;
    c.params =  app.models[c.name].definition.properties;
    c.baseModel = app.models[c.name].definition.settings.base;

    if (c.baseModel != null && typeof(c.baseModel) === "function") {
      c.baseModel = "";
    }
    if (app.models[c.name].definition._ids != null) {
      c.isGenerated = app.models[c.name].definition._ids[0].property.generated;
    } else {
      c.isGenerated = false;
    }
    c.relations = app.models[c.name].definition.settings.relations;
    c.acls = app.models[c.name].definition.settings.acls;
    c.validations = app.models[c.name].definition.settings.validations;
    c.isUser = c.sharedClass.ctor.prototype instanceof app.loopback.User ||
      c.sharedClass.ctor.prototype === app.loopback.User.prototype;
    if (c.isUser) {
      return;
    }
    result[name] = c;
  });

  buildScopes(result);

  return result;
}

var SCOPE_METHOD_REGEX = /^prototype.__([^_]+)__(.+)$/;

function buildScopes(models) {
  for (var modelName in models) {
    buildScopesOfModel(models, modelName);
  }
}

function buildScopesOfModel(models, modelName) {
  var modelClass = models[modelName];

  modelClass.scopes = {};
  modelClass.methods.forEach(function(method) {
    buildScopeMethod(models, modelName, method);
  });

  return modelClass;
}

// reverse-engineer scope method
// defined by loopback-datasource-juggler/lib/scope.js
function buildScopeMethod(models, modelName, method) {
  var modelClass = models[modelName];
  var match = method.name.match(SCOPE_METHOD_REGEX);
  if (!match) return;

  var op = match[1];
  var scopeName = match[2];
  var modelPrototype = modelClass.sharedClass.ctor.prototype;
  var targetClass = modelPrototype[scopeName]._targetClass;

  if (modelClass.scopes[scopeName] === undefined) {
    if (!targetClass) {
      console.error(
        'Warning: scope %s.%s is missing _targetClass property.' +
        '\nThe Angular code for this scope won\'t be generated.' +
        '\nPlease upgrade to the latest version of' +
        '\nloopback-datasource-juggler to fix the problem.',
        modelName, scopeName);
      modelClass.scopes[scopeName] = null;
      return;
    }

    if (!findModelByName(models, targetClass)) {
      console.error(
        'Warning: scope %s.%s targets class %j, which is not exposed ' +
        '\nvia remoting. The Angular code for this scope won\'t be generated.',
        modelName, scopeName, targetClass);
      modelClass.scopes[scopeName] = null;
      return;
    }

    modelClass.scopes[scopeName] = {
    methods: {},
    targetClass: targetClass
    };
  } else if (modelClass.scopes[scopeName] === null) {
    // Skip the scope, the warning was already reported
    return;
  }

  var apiName = scopeName;
  if (op == 'get') {
    // no-op, create the scope accessor
  } else if (op == 'delete') {
    apiName += '.destroyAll';
  } else {
    apiName += '.' + op;
  }

  // Names of resources/models in Angular start with a capital letter
  var ngModelName = modelName[0].toUpperCase() + modelName.slice(1);
  method.internal = 'Use ' + ngModelName + '.' + apiName + '() instead.';

  // build a reverse record to be used in ngResource
  // Product.__find__categories -> Category.::find::product::categories
  var reverseName = '::' + op + '::' + modelName + '::' + scopeName;

  var reverseMethod = Object.create(method);
  reverseMethod.name = reverseName;
  reverseMethod.internal = 'Use ' + ngModelName + '.' + apiName + '() instead.';
  // override possibly inherited values
  reverseMethod.deprecated = false;

  var reverseModel = findModelByName(models, targetClass);
  reverseModel.methods.push(reverseMethod);
  if(reverseMethod.name.match(/create/)){
    var createMany = Object.create(reverseMethod);
    createMany.name = createMany.name.replace(
      /create/,
      'createMany'
    );
    createMany.internal = createMany.internal.replace(
      /create/,
      'createMany'
    );
    createMany.isReturningArray = function() { return true; };
    reverseModel.methods.push(createMany);
  }

  var scopeMethod = Object.create(method);
  scopeMethod.name = reverseName;
  // override possibly inherited values
  scopeMethod.deprecated = false;
  scopeMethod.internal = false;
  modelClass.scopes[scopeName].methods[apiName] = scopeMethod;
  if(scopeMethod.name.match(/create/)){
    var scopeCreateMany = Object.create(scopeMethod);
    scopeCreateMany.name = scopeCreateMany.name.replace(
      /create/,
      'createMany'
    );
    scopeCreateMany.isReturningArray = function() { return true; };
    apiName = apiName.replace(/create/, 'createMany');
    modelClass.scopes[scopeName].methods[apiName] = scopeCreateMany;
  }
}

function findModelByName(models, name) {
  for (var n in models) {
    if (n.toLowerCase() == name.toLowerCase())
      return models[n];
  }
}

function addObjCNames(models, modelPrefix) {
  for (var modelName in models) {
    var meta = models[modelName];
    meta.objcModelName = modelPrefix + modelName[0].toUpperCase() + modelName.slice(1);
    if (meta.baseModel === 'Model' || meta.baseModel === 'PersistedModel') {
      meta.objcBaseModel = 'LB' + meta.baseModel;
    } else {
      console.error('unknown baseModel name: ' + meta.baseModel); // FIXME
    }

    meta.objcParams = [];
    for (var param in meta.params) {
      var type = meta.params[param].type.name;
      console.log('param type: ' + meta.params[param].type.name); // FIXME
      if (type === 'String') {
        meta.params[param].type.objcName = '(nonatomic, copy) NSString *';
      } else if (type === 'Number') {
        meta.params[param].type.objcName = 'long ';
      } else if (type === 'Boolean') {
        meta.params[param].type.objcName = 'BOOL ';
      } else if (typeof type === 'undefined') { // FIXME -- must be an array
        meta.params[param].type.objcName = '(nonatomic) NSArray *';
      } else {
        console.error('ERROR: unknown param type: ' + meta.params[param]); // FIXME
      }
    }
  }
}

function readTemplate(filename) {
  var ret = fs.readFileSync(
    require.resolve(filename),
    { encoding: 'utf-8' }
  );
  return ret;
}

function renderContent(template, modelMetaInfo) {
  var script = ejs.render(template, {
    meta: modelMetaInfo
  });
  script = ngdocToDox(script);

  return script;
}

function ngdocToDox(script) {
  // Transform ngdoc comments and make them compatible with dox/strong-docs
  script = script
    // Insert an empty line (serving as jsdoc description) before @ngdoc
    .replace(/^(\s+\*)( @ngdoc)/gm, '$1\n$1$2')
    // Remove module name from all names
    .replace(/\blbServices\./g, '')
    // Fix `## Example` sections
    .replace(/## Example/g, '**Example**')
    // Annotate Angular objects as jsdoc classes
    .replace(/^((\s+\*) @ngdoc object)/mg, '$1\n$2 @class')
    // Annonotate Angular methods as jsodc methods
    .replace(/^((\s+\*) @ngdoc method)/mg, '$1\n$2 @method')
    // Hide the top-level module description
    .replace(/^(\s+\*) @module.*$/mg, '$1 @private')
    // Change `Model#method` to `Model.method` in @name
    .replace(/^(\s+\* @name) ([^# \n]+)#([^# \n]+) *$/mg, '$1 $2.$3')
    // Change `Model#method` to `Model.method` in @link
    // Do not modify URLs with anchors, e.g. `http://foo/bar#anchor`
    .replace(/({@link [^\/# }\n]+)#([^# }\n]+)/g, '$1.$2');

  return script;
}
