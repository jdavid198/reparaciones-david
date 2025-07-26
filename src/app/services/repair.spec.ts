import { TestBed } from '@angular/core/testing';

import { Repair } from './repair';

describe('Repair', () => {
  let service: Repair;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Repair);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
