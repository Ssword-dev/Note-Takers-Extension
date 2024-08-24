
const vscode = require("vscode");
const fs = require("fs");
const vlc=require("vscode-languageclient")
const { LanguageClient, TransportKind, NotificationType }=require("vscode-languageclient/node")
const path=require("path")
let Default=null
let serverErrStack=null;
let currentContextListeners=[]
async function LoadContexts() {
	if(currentContextListeners){
		for(let item of currentContextListeners){
			item.dispose()
		}
	}
  const ConfigFiles = await vscode.workspace.findFiles("**/*.inteldrc.json");
  const contexts = [];
	const laguageContexts={}
  for (let configs of ConfigFiles) {
    const jsonO = JSON.parse(
      fs.readFileSync(configs.fsPath, { encoding: "utf-8" })
    );
    if(typeof laguageContexts[jsonO.language]==="undefined"){
			laguageContexts[jsonO.language]=[]
		}
		for(context of jsonO.hovers){
			laguageContexts[jsonO.language].push(context)
		}
		
  }
	for(let language in laguageContexts){
		currentContextListeners.push(
			vscode.languages.registerHoverProvider(
				{
					"language":language,
				},
				{
					provideHover(d,p,t){
						const text=d.getText(d.getWordRangeAtPosition(p))
						const match=laguageContexts[language].find(v=>v.identifier==text)
						if(match){
							return new vscode.Hover(match.doc)
						}
						return undefined
					}
				}
			)
		)
	}
}
/**
 * @type {LanguageClient|null}
 */
let client=null;
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log(
    'Congratulations, your extension "Intellisense.config-reader" is now active!'
  );

  // Register the command to read autocomplete configuration
  const createCompletion = vscode.commands.registerCommand(
    "intellisense-config-reader.read-autocomplete-config",
    async () => {
      try {
        // Show an open dialog to select the configuration file
        const uri = await vscode.window.showOpenDialog({
          canSelectMany: false,
          canSelectFiles: true,
          filters: {
            "Intellisense Config": ["vsi.json"],
          },
        });

        // If no file,return
        if (!uri || uri.length === 0) {
          return;
        }

        const filePath = uri[0].fsPath;

        // R&F the json file
        const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
        const jsonConfig = JSON.parse(fileContent);

        // Register the completion item provider based on the config file
        const vscodeAutoCompleter =
          vscode.languages.registerCompletionItemProvider(jsonConfig.language, {
            provideCompletionItems(document, position, token, ctx) {
              const completions = jsonConfig.autocompletes.map((e) => {
                return new vscode.CompletionItem(e.identifier, e.type);
              });
              return completions;
            },
          });

        context.subscriptions.push(vscodeAutoCompleter);
        vscode.window.showInformationMessage(
          "Autocomplete configuration loaded successfully!"
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error loading autocomplete config: ${error.message}`
        );
      }
    }
  );
  const createHover = vscode.commands.registerCommand(
    "intellisense-config-reader.read-hover-config",async(...a)=>{
		const path=await vscode.window.showOpenDialog({
			"canSelectFiles":true,
			"canSelectMany":false,
			"canSelectFolders":false,
			"filters":{
				"Vscode Hover Completion File":["hvs.json"]
			}
		})
		const fc=fs.readFileSync(path[0].fsPath,{encoding:"utf-8"})
		/**
		 * @type {{language:string,hovers:[{identifier:string,doc:string}]}}
		 */
		const jsonO=JSON.parse(fc)
		return vscode.languages.registerHoverProvider(
			jsonO.language,{
				provideHover(doc,pos,tok){
					const Text=doc.getText(doc.getWordRangeAtPosition(pos))
					const Match=jsonO.hovers.find(v=>v.identifier==Text)
					if(Match){
						return new vscode.Hover(Match.doc)
					}
					
				}
			}
		)
		
	}
	
  );
  const createColor = vscode.commands.registerCommand(
	"intellisense-config-reader.read-color-config",
	async(...a)=>{
		const path = await vscode.window.showOpenDialog({
			"canSelectFiles":true,
			"canSelectFolders":false,
			"canSelectMany":false,
			"filters":{
				"Vscode Color file":["cvs.json"]
			}
		})
		
		const fc=fs.readFileSync(path[0].fsPath,{encoding:"utf-8"})
		/**
		 * @type {{language:string,colors:[{identifier:string,color:number,presentationLabel:string}]}}
		 */
		const jsonO=JSON.parse(fc)
		return vscode.languages.registerDocumentHighlightProvider(jsonO.language,{
			provideDocumentHighlights(doc,pos,tok){
				const highlights=[]
				const Text=doc.getText(doc.getWordRangeAtPosition(pos))
				jsonO.colors.map(v=>{
					const pattern=new RegExp(v.identifier)
					const Matches=pattern.exec(Text)
					if(Matches!==null){
						highlights.push(new vscode.DocumentHighlight(doc.getWordRangeAtPosition(pos),v.color))
					}
				})
				return highlights
			}
		})
	}
  )
	const createTypeAnnotation=vscode.commands.registerCommand("Intellisense.customType",async(..._)=>{
		const fp = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      canSelectFolders: false,
      filters: {
        "Type Annotation": ["tsv.json"],
      },
    });
		const fpl=fp[0].fsPath
		const jsonO=JSON.parse(fs.readFileSync(fpl,{encoding:"utf-8"}))
		vscode.window.showInformationMessage("Processing data...")
		return [vscode.languages.registerHoverProvider(
			{
				"language":jsonO.language,
				"pattern":jsonO.pattern,
			},{
				provideHover(doc,pos,tok){
					const Text = doc.getText(doc.getWordRangeAtPosition(pos));
          const Match = jsonO.hovers.find((v) => v.identifier == Text);
					if(typeof Match.onHover !== "undefined"){
						vscode.window.showInformationMessage(Match.onHover)
					}
          if (Match) {
						const lang=jsonO.language!="javascript"?jsonO.language:"typescript"
						const hv = new vscode.Hover(
							new vscode.MarkdownString(
                `${Match.doc}\n\n-----\n\`\`\`${lang}\n${Match.identifier}:${Match.type}\n\`\`\``
            ));
						
            return hv;
          }
				}
			}
		),vscode.languages.registerCompletionItemProvider(
			{
				"language":jsonO.language,
				"pattern":jsonO.pattern
			},{
				provideCompletionItems(doc,pos,tok){
					const completions = jsonO.autocompletes.map((e) => {
						const compl = new vscode.CompletionItem(e.identifier, e.type);
						compl.detail=e.annotation
						
            return compl;
          });
					return completions
				}
			}
		)]
	})
	const serverModule=context.asAbsolutePath(
		path.join("server","server.js")
	);
	context.subscriptions.push(createTypeAnnotation)
  context.subscriptions.push(createColor)
  context.subscriptions.push(createCompletion);
  context.subscriptions.push(createHover);
	/**client = new LanguageClient(
    "intellisenseConfigReader",
    {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: {
        module: serverModule,
      },
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
			
    },
    {
			documentSelector:[{scheme:"file"}] // all files
		}
  );
	**/const DescriptionLoader=vscode.commands.registerCommand("intellisense.dl",(...a)=>{
		LoadContexts().then((_v)=>{
			vscode.window.showInformationMessage("successfully reloaded schema!")
		}).catch((_)=>{
			vscode.window.showErrorMessage("couldn't load schema", _.message);
		})
	})
	LoadContexts()
    .then((_v) => {
      vscode.window.showInformationMessage("successfully reloaded schema!");
    })
    .catch((_) => {
      vscode.window.showErrorMessage("couldn't load schema",_.message);
    });
	//client.start()
	//const MessageNotif=new NotificationType("message")
	/**client.onNotification(MessageNotif,(params)=>{
		vscode.window.showInformationMessage(params)
		console.log(params.message)
	});*/
	
}

function deactivate() {
	if(serverErrStack){
		console.log(__dirname)
		fs.writeFileSync("./errlog.txt",serverErrStack.stack.toString(),{"encoding":"utf-8"})
	}
	
	/**if(!client){
		return undefined;
	}
	return client.stop()*/
}

module.exports = {
  activate,
  deactivate,
};
