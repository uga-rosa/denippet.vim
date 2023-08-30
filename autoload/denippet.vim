function denippet#load(filepath, ...) abort
  const filetype = a:0 ? a:1 : filepath->fnamemodify(":t:r")
  call denops#plugin#wait_async('denippet', {
        \ -> denops#notify('denippet', 'load', a:filepath, filetype)
        \})
endfunction

function denippet#expandable() abort
  return denops#request('denippet', 'expandable')
endfunction

function denippet#expand() abort
  call denops#request('denippet', 'expand')
endfunction

function denippet#jumpable() abort
  return denops#request('denippet', 'jumpable')
endfunction

function denippet#jump(dir) abort
  call denops#request('denippet', 'jump', a:dir)
endfunction

function denippet#choosable() abort
  return denops#request('denippet', 'choosable')
endfunction

function denippet#choice(dir) abort
  call denops#request('denippet', 'choice', a:dir)
endfunction
