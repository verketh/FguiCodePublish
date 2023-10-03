//FYI: https://github.com/Tencent/puerts/blob/master/doc/unity/manual.md

import { FairyEditor, System } from 'csharp';
import { ICodeWriterConfig } from './CodeWriter';

const App = FairyEditor.App;

/**
 * 自定义代码导出
 */
class TypeCodeWriter{
    private blockStart:string;
    private blockEnd:string;
    private blockFromNewLine:boolean;
    private indentStr:string;
    private endOfLine:string;
    private lines:Array<string>;
    private indent:number;
    private fileMark:string;
    private usingTabs:boolean;
    constructor(config?: ICodeWriterConfig){
        config = config || {};
        this.blockStart = config.blockStart || "{";
        this.blockEnd = config.blockEnd || "}";
        this.blockFromNewLine = config.blockFromNewLine;
        if(this.blockFromNewLine == null || this.blockFromNewLine == undefined){
            this.blockFromNewLine = false;
        }
        if(config.usingTabs){
            this.indentStr = "\t";
        }else{
            this.indentStr = '    ';
        }
        this.usingTabs = config.usingTabs;
        this.endOfLine = config.endOfLine || '\n';
        this.lines = [];
        this.indent = 0;
        this.writeMark()
    }
    writeImports(imports:Array<string>):void{
        if(this.lines.length > 0 && imports.length > 0){
            //插入一个空行
            this.lines.splice(1,0,"");
            //插入导入
            this.lines.splice(2,0,...imports);
        }
    }
    writeMark(): void{
        this.lines.push("/** This is an automatically generated class by FairyGUI. Please do not modify it. **/");
        this.lines.push("");
    }
    writeln(fmt?: string, ...args: any[]): TypeCodeWriter{
        if (! fmt) {
            this.lines.push("");
            return this;
        }

        let str = ''
        for (let i = 0; i < this.indent;i++) {
            str += this.indentStr
        }
        //TODO
        // str += string.format(format, ...)
        str += fmt;
        this.lines.push(str);

        return this;
    }
    startBlock(): TypeCodeWriter{
        if (this.blockFromNewLine) {
            this.writeln(this.blockStart);
        }else{
            let str = this.lines[this.lines.length - 1];
            this.lines[this.lines.length - 1] = str + ' ' + this.blockStart;
        }
        this.indent = this.indent + 1;
        return this
    }
    endBlock(): TypeCodeWriter{
        this.indent = this.indent - 1;
        this.writeln(this.blockEnd);

        return this;
    }
    incIndent(): TypeCodeWriter{
        this.indent = this.indent + 1
        return this
    }
    decIndent(): TypeCodeWriter{
        this.indent = this.indent - 1
        return this;
    }
    reset(): void{
        if (this.lines.length > 0) {
            this.lines = []
        }
        this.indent = 0
        this.writeMark();
    }
    toString(): string{
        let str = "";
        for (let i = 0; i < this.lines.length; i++) {
            if(i + 1 == this.lines.length){
                str += this.lines[i];
            }else{
                str += this.lines[i] + this.endOfLine;
            }
            
        }
        return str;
    }
    save(filePath: string): void{
        let str = this.toString();
        System.IO.File.WriteAllText(filePath, str)
    }
}

//常量
const KEY_PUBLISH = "Publish";
//fgui内置名称
const BUILT_IN_NAME = ["title","icon","bar","bar_v","grip","arrow1","arrow2","ani","list","closeButton","dragArea","contentArea"];
const CONTROL_IN_NAME = ["button","grayed","checked","expanded","leaf"];
//fgui内置类型
const BUILT_IN_TYPE = ["GComponent","GButton","GComboBox","GGraph","GGroup","GImage","GLabel","GList","GObjectPool","GLoader","GLoader3D","GMovieClip","GProgressBar","GRichTextField","GRoot","GScrollBar","GSlider","GTextInput","GTree","GTreeNode","GTextField","Controller","Transition"];

//全局发布设置
namespace Config{
    export let globalPublishSettings:FairyEditor.GlobalPublishSettings;
}

function onPublish (handler:FairyEditor.PublishHandler){
    //该包是否发布代码
    if(!(handler.genCode)){
        return
    }
    Config.globalPublishSettings = (App.project.GetSettings(KEY_PUBLISH) as FairyEditor.GlobalPublishSettings);
    if(Config.globalPublishSettings.codeGeneration.allowGenCode){
        console.log("开始生成代码...");
        genCode(handler);
        console.log("生成代码完成!");
    }
}

function onDestroy() {
    console.log("退出插件!");
}
console.log('CodePublish');

/**
 * 生成代码
 * @param handler 
 */
function genCode(handler:FairyEditor.PublishHandler){
    //屏蔽默认导出
    handler.genCode = false;
    //报名
    const pkgName = handler.pkg.name;
    //导出路径
    const exportCodePath = handler.exportCodePath + "/" + pkgName;
    //获取需要导出的
    const codeGeneration = Config.globalPublishSettings.codeGeneration;
    const classes = handler.CollectClasses(codeGeneration.ignoreNoname,codeGeneration.ignoreNoname,"");
    //检查目标文件夹是否存在,并且删除旧的文件
    handler.SetupCodeFolder(exportCodePath,"ts");

    //类名前缀
    const classNamePrefix = codeGeneration.classNamePrefix;
    //成员名前缀
    const memberNamePrefix = codeGeneration.memberNamePrefix;
    //导入的类
    const imports:Array<string> = [];
    let importMap:{[key:string]:boolean} = {};
    //成员变量初始化
    const memberInit:Array<string> = [];

    //binder
    const binder : {
        imports:Array<string>,
        extensions:Array<string>
    } = {
        imports:[],
        extensions:[]
    }

    console.log(handler.pkg.name,classes.Count);

    //遍历生成
    let writer = new TypeCodeWriter({usingTabs:true});
    for (let i = 0; i < classes.Count; i++) {
        writer.reset();
        imports.length = 0;
        importMap = {};
        memberInit.length = 0;

        const classInfo = classes.get_Item(i);
        const members = classInfo.members;

        //binder
        binder.imports.push(`import ${classInfo.className} from "./${classInfo.className}";`);
        binder.extensions.push(`fgui.UIObjectFactory.setExtension(${classInfo.className}.URL, ${classInfo.className});`);

        
        writer.writeln(`export default class ${classInfo.className} extends fgui.${classInfo.superClassName}`);
        writer.startBlock();
        writer.writeln("");

        //类成员
        for (let k = 0; k < members.Count; k++) {
            const member = members.get_Item(k);
            let type = member.type;
            let typePath = "";
            //当前成员组件不在同一个包,导出类型判断
            if(member.res && handler.pkg.name != member.res.owner.name){
                if(isMemberNeedGenCode(handler,member.res)){
                    const name = member.res.fileName.replace(".xml","")
                    type = `${classNamePrefix}${name}`;
                    typePath = `../${member.res.owner.name}/${type}`;
                }
            }
            let isInType = true;
            if(BUILT_IN_TYPE.indexOf(type) >= 0){
                //拼接命名空间
                type = "fgui." + type;
            }else{
                isInType = false;
                if(typePath == ""){
                    typePath = `./${type}`;
                }
                //类型导入
                if(!importMap[type]){
                    importMap[type] = true;
                    imports.push(`import ${type} from "${typePath}";`);
                }
            }
            writer.writeln(`public ${member.varName}:${type};`);
            //变量成员初始化
            if(Config.globalPublishSettings.codeGeneration.getMemberByName){
                if(isInType && member.type == "Controller"){
                    memberInit.push(`this.${member.varName} = this.getController(${member.name});`)
                }else if(isInType && member.type == "Transition"){
                    memberInit.push(`this.${member.varName} = this.getTransition(${member.name});`)
                }else{
                    memberInit.push(`this.${member.varName} = <${type}>(this.getChild(${member.name}));`)
                }
            }else{
                if(isInType && member.type == "Controller"){
                    memberInit.push(`this.${member.varName} = this.getControllerAt(${member.index});`)
                }else if(isInType && member.type == "Transition"){
                    memberInit.push(`this.${member.varName} = this.getTransitionAt(${member.index});`)
                }else{
                    memberInit.push(`this.${member.varName} = <${type}>(this.getChildAt(${member.index}));`)
                }
            }
        }

        //静态成员URL
        writer.writeln(`public static URL:string = "${classInfo.res.GetURL()}";`)
        writer.writeln("");

        //创建函数
        writer.writeln(`public static createInstance():${classInfo.className}`);
        writer.startBlock();
        writer.writeln(`return <${classInfo.className}>(fgui.UIPackage.createObject("${classInfo.res.owner.name}", "${classInfo.resName}"));`);
        writer.endBlock();
        writer.writeln("");

        //构造函数
        writer.writeln("protected onConstruct():void");
        writer.startBlock();
        for (let i = 0; i < memberInit.length; i++) {
            writer.writeln(memberInit[i])
        }
        writer.endBlock();



        writer.endBlock();
        //插入导入类
        writer.writeImports(imports);

        writer.save(`${exportCodePath}/${classInfo.className}.ts`);
    }

    //写出Binder
    writer.reset();
    for (let i = 0; i < binder.imports.length; i++) {
        writer.writeln(binder.imports[i]);
    }
    writer.writeln();
    writer.writeln(`export default class ${handler.pkg.name}Binder`);
    writer.startBlock();
    writer.writeln("public static bindAll():void");
    writer.startBlock();
    for (let i = 0; i < binder.extensions.length; i++) {
        writer.writeln(binder.extensions[i]);
    }
    writer.endBlock();
    writer.endBlock();
    writer.save(`${exportCodePath}/${handler.pkg.name}Binder.ts`);
}
/**
 * 判断指定item是否导出了代码
 * @param handler 
 * @param item 
 */
function isMemberNeedGenCode(handler:FairyEditor.PublishHandler,item: FairyEditor.FPackageItem):boolean{
    //不生成使用默认名称的成员
    if(Config.globalPublishSettings.codeGeneration.ignoreNoname){
        let asset = item.GetAsset();
        if(asset instanceof FairyEditor.ComponentAsset){
            //遍历成员校验命名
            const list = (asset as FairyEditor.ComponentAsset).displayList;
            let hasCustomize = false;
            for (let i = 0; i < list.Count; i++) {
                const element = list.get_Item(i);
                //控件名
                const name = element.desc.GetAttribute("name");
                //是否是内置名字
                if(BUILT_IN_NAME.indexOf(name) >= 0){
                    continue;
                }
                //n
                if(name.startsWith("n")){
                    const num = Number(name.replace("n",""));
                    if(Number.isNaN(num) == false){
                        continue;
                    }
                }
                hasCustomize = true;
                break;
            }
            if(!hasCustomize){
                //自定义控制器判断
                const elements = (asset as FairyEditor.ComponentAsset).xml.elements;
                for (let k = 0; k < elements.Count; k++) {
                    const element = elements.get_Item(k);
                    if(element.name != "controller"){
                        continue;
                    }
                    const name = element.GetAttribute("name");
                    if(CONTROL_IN_NAME.indexOf(name) < 0){
                        hasCustomize = true;
                        break;
                    }
                }
            }

            if(hasCustomize){
                return true;
            }
        }
    }
    return false;
}


export {onPublish,onDestroy};