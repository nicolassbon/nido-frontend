import { TestBed } from '@angular/core/testing';
import { PaywallService } from './paywall';

describe('PaywallService', () => {
  let service: PaywallService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PaywallService],
    });
    service = TestBed.inject(PaywallService);
  });

  it('should be created and default to closed', () => {
    expect(service).toBeTruthy();
    expect(service.isOpen()).toBe(false);
  });

  it('should open and close the paywall modal reactively', () => {
    service.open();
    expect(service.isOpen()).toBe(true);

    service.close();
    expect(service.isOpen()).toBe(false);
  });
});
