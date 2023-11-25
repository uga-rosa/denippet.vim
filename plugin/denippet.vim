if exists('g:loaded_denippet')
  finish
endif
let g:loaded_denippet = 1

" Configuration
let g:denippet_wait_time = get(g:, 'denippet_wait_time', 200)

inoremap <Plug>(denippet-expand) <Cmd>call denippet#expand()<CR>
inoremap <Plug>(denippet-expand-or-jump) <Cmd>call <SID>expand_or_jump()<CR>
function s:expand_or_jump() abort
  if denippet#expandable()
    call denippet#expand()
  elseif denippet#jumpable()
    call denippet#jump()
  endif
endfunction

inoremap <Plug>(denippet-jump-next) <Cmd>call denippet#jump(+1)<CR>
snoremap <Plug>(denippet-jump-next) <Cmd>call denippet#jump(+1)<CR>
inoremap <Plug>(denippet-jump-prev) <Cmd>call denippet#jump(-1)<CR>
snoremap <Plug>(denippet-jump-prev) <Cmd>call denippet#jump(-1)<CR>

inoremap <Plug>(denippet-choice-next) <Cmd>call denippet#choice(+1)<CR>
inoremap <Plug>(denippet-choice-prev) <Cmd>call denippet#choice(-1)<CR>
