import Acl from 'acl2';

import aclModels from '@/build/acl-models.preval';
import { aclSetResourceReducer } from '@/utils/acl';


export async function getUserPermissions(
  user,
  roles
) {
  const acl = new Acl(new Acl.memoryBackend());

  // Server defined ACL rules
  await acl.allow(aclModels);

  // Current user and its associated roles
  await acl.addUserRoles(user, roles);

  // Resources for which permissions should be retrieved
  const modelResources = aclModels.reduce(aclSetResourceReducer, []);

  // Parse and return the current user permissions
  return new Promise<AuthPermissions>((resolve, reject) => {
    acl.allowedPermissions(user, modelResources, (err, permissions) => {
      if (err) reject(err.message);
      resolve(permissions);
    });
  });
}
