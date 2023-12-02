function s:regex_builder(prefix) abort
  let regex = '\V\%('
  let fixed = []
  for p in a:prefix
    if p->len() > 1
      call add(fixed, strcharpart(p, 0, 1) . '\%[' . strcharpart(p, 1) . ']')
    else
      call add(fixed, p)
    endif
  endfor
  let regex .= fixed->join('\|')
  let regex .= '\)\_$'
  return regex
endfunction

function denippet#load#base(prefix, from_normal) abort
  let pattern = a:from_normal
        \ ? '\v^$'
        \ : '\v^' . s:regex_builder(a:prefix)
  let enabled = v:true
  let enabled = enabled && line('$') == 1
  let enabled = enabled && getline(1) =~# pattern
  return enabled
endfunction

function denippet#load#start(prefix, from_normal) abort
  if a:from_normal && col('.') == 1
    let line_before_cursor = ''
  else
    let line_before_cursor = getline('.')[:col('.')-2]
  endif
  let pattern = a:from_normal
        \ ? '\v^\s*$'
        \ : '\v^\s*' . s:regex_builder(a:prefix)
  return match(line_before_cursor, pattern) > -1
endfunction
