function s:send_notify() abort
  for [method, params] in s:pending_notify
    call denops#notify('denippet', method, params)
  endfor
endfunction

function s:notify_later(method, params) abort
  let s:pending_notify = add(
        \ get(s:, 'pending_notify', []), [a:method, a:params])
  augroup denippet-notify
    au!
    au User DenopsPluginPost:denippet ++once call s:send_notify()
  augroup END
endfunction

function s:notify(method, params = []) abort
  if denops#plugin#is_loaded('denippet')
    call denops#notify('denippet', a:method, a:params)
  else
    call s:notify_later(a:method, a:params)
  endif
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

function denippet#expand() abort
  call s:notify('expand')
endfunction

function denippet#jumpable(...) abort
  const dir = a:0 ? a:1 : 1
  return s:request('jumpable', [dir])
endfunction

function denippet#jump(...) abort
  const dir = a:0 ? a:1 : 1
  call s:notify('jump', [dir])
endfunction

function denippet#choosable() abort
  return s:request('choosable')
endfunction

function denippet#choice(dir) abort
  call s:notify('choice', [a:dir])
endfunction

function denippet#get_complete_items() abort
  return s:request('getCompleteItems')
endfunction

function denippet#to_string(body) abort
  return s:request('snippetToString', [a:body])
endfunction

function denippet#anonymous(body) abort
  call s:notify('anonymous', [a:body])
endfunction
