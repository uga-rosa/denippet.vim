" Copyright 2021 vim-denops
" Released under the MIT license
" https://github.com/vim-denops/denops.vim/blob/6c7ebef6f71b948a152c09bd844fba00f8fee3d6/LICENSE
" Original code is here
" https://github.com/vim-denops/denops.vim/blob/6c7ebef6f71b948a152c09bd844fba00f8fee3d6/autoload/denops/_internal/wait.vim

if exists('*wait')
  function denippet#wait#wait(...) abort
    call call('wait', a:000)
  endfunction
else
  " NOTE:
  " The line 'call getchar(0)' is required to enable Ctrl-C
  " interruption in Vim on Windows.
  " See https://github.com/vim-denops/denops.vim/issues/182
  function! s:sleep(duration) abort
    call getchar(0)
    execute printf('sleep %dm', a:duration)
  endfunction

  function! denippet#wait#wait(timeout, condition, interval) abort
    let l:s = reltime()
    try
      while !a:condition()
        if reltimefloat(reltime(l:s)) * 1000 > a:timeout
          return -1
        endif
        call s:sleep(a:interval)
      endwhile
    catch /^Vim:Interrupt$/
      return -2
    endtry
  endfunction
endif
