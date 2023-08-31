function denippet#load(filepath, ...) abort
  const filetype = a:0 ? a:1 : a:filepath->fnamemodify(":t:r")
  call denops#plugin#wait_async('denippet', {
        \ -> denops#notify('denippet', 'load', [a:filepath, filetype])
        \})
endfunction

function denippet#expandable() abort
  return denops#request('denippet', 'expandable', [])
endfunction

function denippet#expand() abort
  call denops#request('denippet', 'expand', [])
endfunction

function denippet#jumpable(...) abort
  const dir = a:0 ? a:1 : 1
  return denops#request('denippet', 'jumpable', [dir])
endfunction

function denippet#jump(...) abort
  const dir = a:0 ? a:1 : 1
  call denops#request('denippet', 'jump', [dir])
endfunction

function denippet#choosable() abort
  return denops#request('denippet', 'choosable', [])
endfunction

function denippet#choice(dir) abort
  call denops#request('denippet', 'choice', [a:dir])
endfunction
