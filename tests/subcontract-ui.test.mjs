import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const validation = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/subcontractValidation.ts',import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:validation});
const source=ts.transpileModule(fs.readFileSync(new URL('../components/SubcontractModule.tsx',import.meta.url),'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}
}).outputText;
const contractor={id:'c',name:'المقاول',specialty:'تركيب',status:'active',phone:'123'};
const contract={id:'s',number:'SC-1',subcontractorId:'c',subcontractorName:'المقاول',projectId:'p',projectName:'المشروع',status:'active',totalAmount:100,progressPercentage:0,payments:[],date:'2026-09-05',startDate:'2026-09-05',endDate:'2026-12-01'};
function render(overrides={}, service={}) {
    let index=0; const setters=[];
    const react={...React,useMemo:f=>f(),useState:initial=>{
        const i=index++; return [Object.hasOwn(overrides,i)?overrides[i]:initial,v=>setters.push([i,v])];
    }};
    const output={};
    const context={subcontractors:[contractor],subcontracts:[contract],busy:false,error:'',canManage:true,canDelete:true,
        addSubcontract:async()=>false,updateSubcontract:async()=>false,...service};
    vm.runInNewContext(source,{exports:output,require:id=>{
        if(id==='react') return react;
        if(id.includes('SubcontractContext'))return {useSubcontract:()=>context};
        if(id.includes('ProjectContext'))return {useProject:()=>({projects:[{id:'p',name:'المشروع'}]})};
        if(id.includes('subcontractService'))return {subcontractService:{}};
        if(id.includes('subcontractValidation'))return validation;
        return require(id);
    },alert:()=>{},window:{},setTimeout:()=>{},crypto:globalThis.crypto});
    const tree=output.SubcontractModule();
    return {tree,setters,html:renderToStaticMarkup(tree)};
}
function find(node,label) {
    if(!node || typeof node!=='object')return null;
    if(node.type==='button' && node.props.children===label)return node;
    for(const child of React.Children.toArray(node.props?.children)) { const found=find(child,label);if(found)return found; }
    return null;
}
test('all main views and edit forms render with real fixture data',()=>{
    assert.match(render({0:'contracts'}).html,/مرفقات العقد/);
    assert.match(render({0:'subcontractors'}).html,/المقاول/);
    assert.match(render({7:true,8:contract}).html,/نسبة إنجاز العقد/);
    assert.match(render({5:true,6:contractor}).html,/حالة المقاول/);
});
test('filter hides nonmatching contracts',()=>{
    assert.doesNotMatch(render({0:'contracts',3:'other'}).html,/SC-1/);
});
test('failed cloud save keeps contract form open',async()=>{
    const {tree,setters}=render({7:true,8:contract});
    await find(tree,'حفظ العقد').props.onClick();
    assert.equal(setters.some(([index,value])=>index===7 && value===false),false);
});
test('view-only user cannot save contract',()=>{
    const {tree}=render({7:true,8:contract},{canManage:false,canDelete:false});
    assert.equal(find(tree,'حفظ العقد').props.disabled,true);
});
