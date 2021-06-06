import React, { ChangeEvent } from "react"
import { merge, Observable } from "rxjs"
import { debounceTime, map } from "rxjs/operators"
import { makeStore, useStore } from "../src/store"

const CORVIDAE = ["Crow", "Raven", "Rook", "Jackdaw", "Jay", "Magpie", "Treepie", "Chough"]

const filterCrowKind = (pattern: string) => CORVIDAE.filter(
  c => c.search(new RegExp(pattern, "i")) !== -1)

export function CorvidPicker(props: {onSelected?: (country: string) => void, value?: string}) {
  type FormState = {
    currentValue?: string,
    isSearching?: boolean, 
    autocompletionResults?: string[], 
    selected?: string
  }

  const store = makeStore(
    {} as FormState, 
    {
      pick: ($: Observable<[corvid: string]>) => $.pipe(map(([corvid]) => state => ({...state, selected: corvid}))),
      textChanged: ($: Observable<[event: ChangeEvent<HTMLInputElement>]>) => merge(
        $.pipe(
          map((([event]) => event.target.value)),
          map(currentValue => (state: FormState) => ({...state, currentValue, isSearching: true}))),
        $.pipe(
            debounceTime(500),
            map(([event]) => filterCrowKind(event.target.value)),
            map(autocompletionResults => (state: FormState) => ({
              ...state, 
              isSearching: false,
              autocompletionResults})),
            )
        ),
    },
    {
      inputAction: (prop$: Observable<[string | undefined]>) => prop$.pipe(
        map(([selected]) => (state: FormState) => ({...state, selected})))
    }
  )
  const [actions, state] = useStore(store, [props.value])
  return <div className="corvid-picker">
    <div className={state.isSearching ? "in-progress" : ""}>
      Search for: <input 
        onChange={actions.textChanged} 
        value={state.currentValue || ""} 
        placeholder="crows, magpies, ravens..."
      />
    </div>
    {state.selected ? <div>My favorite bird is a {state.selected}</div>: ""}
    <ol>
      {(state.autocompletionResults || []).map(e => 
        <li key={e} onClick={() => {actions.pick(e);props.onSelected?.(e)}}>{e}</li>
      )}
    </ol>
  </div>
}
