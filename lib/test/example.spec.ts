import {expect} from 'chai'

describe('test description', () => {
  it('checking parameter', () => {
    expect({data: "test"}).to.be.an("object").to.have.property("data").to.equal("test");
  })
})
