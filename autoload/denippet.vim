function s:notify(method, params = []) abort
  call denops#plugin#wait_async('denippet', {
        \ -> denops#notify('denippet', a:method, a:params)
        \})
endfunction

function s:request(method, params = []) abort
  if denops#plugin#wait('denippet') != 0
    return
  endif
  return denops#request('denippet', a:method, a:params)
endfunction

function denippet#load(filepath, ...) abort
  const filetype = a:0 ? a:1 : a:filepath->fnamemodify(":t:r")
  call s:notify('load', [a:filepath, filetype])
endfunction

function denippet#expandable() abort
  return s:request('expandable')
endfunction

function denippet#expand(...) abort
  call s:notify('expand', a:000)
endfunction

function denippet#anonymous(body) abort
  call s:notify('anonymous', [a:body])
endfunction

function denippet#jumpable(...) abort
  const dir = a:0 ? a:1 : 1
  return s:request('jumpable', [dir])
endfunction

function denippet#jump(...) abort
  const dir = a:0 ? a:1 : 1
  call s:request('jump', [dir])
endfunction

function denippet#choosable() abort
  return s:request('choosable')
endfunction

function denippet#choice(dir) abort
  call s:request('choice', [a:dir])
endfunction

function s:to_boolean(x) abort
  return a:x ? v:true : v:false
endfunction

function denippet#get_complete_items(...) abort
  let from_normal = a:0 > 0 ? a:1 : mode() ==# 'n'
  return s:request('getCompleteItems', [s:to_boolean(from_normal)])
endfunction

function denippet#to_string(body) abort
  return s:request('snippetToString', [a:body])
endfunction

function denippet#register_variable(name, cb) abort
  let id = denops#callback#register(a:cb)
  call s:notify('registerVariable', [a:name, id])
endfunction

function denippet#guard() abort
  call s:request('guard')
endfunction

function denippet#unguard() abort
  call s:request('unguard')
endfunction
