import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * #213 changed homepage «پذیرش» to /adoption, but live clients (and old
 * bookmarks) still opened /#pets via the leftover section id + SW-cached
 * `<a href="#pets">`. Any leftover hash must land on the listing.
 */
export function LegacyAdoptionHashRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.hash !== '#pets') return;
    navigate({ pathname: '/adoption', search: location.search, hash: '' }, { replace: true });
  }, [location.hash, location.search, navigate]);

  return null;
}
