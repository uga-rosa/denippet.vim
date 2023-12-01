function denippet#load#base(from_normal) abort
  let enabled = v:true
  let enabled = enabled && line('$') == 1
  let enabled = enabled && getline(1) =~# (a:from_normal ? '\v^$' : '\v^\k+$')
  return enabled
endfunction

function denippet#load#start(from_normal) abort
  if a:from_normal && col('.') == 1
    let line_before_cursor = ''
  else
    let line_before_cursor = getline('.')[:col('.')-2]
  endif
  let pattern = a:from_normal ? '\v^\s*$' : '\v^\s*\k*$'
  return match(line_before_cursor, pattern) > -1
endfunction
