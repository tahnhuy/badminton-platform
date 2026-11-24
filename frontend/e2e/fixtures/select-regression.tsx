import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Select } from '../../src/components/ui/select';

function Fixture() {
  const [value, setValue] = useState('a');
  const options = [{ value: '', label: 'Choose' }, { value: 'a', label: 'Alpha' }, { value: '__empty__', label: 'Real sentinel' }];
  return <form id="test-form" onSubmit={event => event.preventDefault()}>
    <label>Controlled<Select value={value} onChange={setValue} options={options.filter(option => option.value)} placeholder="Choose" /></label>
    <button type="button" onClick={() => setValue('')}>Clear</button>
    <label>Required<Select name="required" required defaultValue="" options={options} /></label>
    <label>Uncontrolled<Select name="uncontrolled" defaultValue="a" options={options} /></label>
    <fieldset disabled><label>Disabled<Select name="disabled" defaultValue="a" options={options} /></label></fieldset>
    <button type="submit">Submit</button><button type="reset">Reset</button>
  </form>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
