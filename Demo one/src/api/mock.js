// Mock API layer with simulated delays and canned responses
const wait = (ms=800)=> new Promise(res=>setTimeout(res, ms))

let docCounter = 1
let fileStore = {}

export async function uploadFile(file){
  await wait(400 + Math.random()*400)
  const fileId = 'file_' + Date.now()
  fileStore[fileId] = { fileId, name: file.name || 'uploaded', size: file.size || 0, status: 'ready' }
  return { fileId, name: file.name || 'uploaded', size: file.size || 0 }
}

export async function analyzeFile({ fileId }){
  // simulate multi-stage analyze
  fileStore[fileId] = { ...(fileStore[fileId]||{}), status: 'analyzing' }
  await wait(800 + Math.random()*1000)
  const docId = 'doc_' + (docCounter++)
  const pages = Math.max(1, Math.floor(Math.random()*10))
  const summary = {
    title: (fileStore[fileId] && fileStore[fileId].name) || 'Document',
    pages,
    excerpt: 'This is a short excerpt describing the document and its contents.'
  }
  fileStore[fileId] = { ...(fileStore[fileId]||{}), status: 'done', docId, summary }
  return { status: 'done', docId, summary }
}

export async function agentResponse({ conversationId, text }){
  await wait(700 + Math.random()*800)
  const messageId = 'msg_' + Date.now()
  // fake sources
  const sources = []
  if(Math.random()>0.4){
    sources.push({ docId: 'doc_1', filename: 'sample.pdf', page: 3 })
  }
  const ttsUrl = '/audio/fake.mp3'
  const reply = {
    messageId,
    text: `Agent reply to: "${text.slice(0,120)}"`,
    sources,
    ttsUrl
  }
  return reply
}

export async function tts({ text, voice }){
  await wait(300 + Math.random()*400)
  return { audioUrl: '/audio/fake.mp3' }
}
