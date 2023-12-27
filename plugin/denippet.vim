if exists('g:loaded_denippet')
  finish
endif
let g:loaded_denippet = 1

let g:denippet_sync_delay = get(g:, 'denippet_sync_delay', 0)
let g:denippet_drop_on_zero = get(g:, 'denippet_drop_on_zero', v:false)

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

" Empty autocmd for :do
au InsertLeave * :
au ModeChanged *:n :
au User DenippetNodeEnter,DenippetNodeLeave,DenippetChoiceSelected :
