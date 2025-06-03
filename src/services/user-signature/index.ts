import {UserSignatureService} from './UserSignatureService';
import {createSaltStore} from '../salt-store';

const service = new UserSignatureService(createSaltStore());

export {service as userSignatureService};
export {UserSignatureService} from './UserSignatureService';
